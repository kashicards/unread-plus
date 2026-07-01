import { FileView, Plugin, TAbstractFile, TFile } from 'obsidian';
import { StateManager } from './src/state-manager';
import { BadgeRenderer } from './src/badge-renderer';
import { SettingsTab } from './src/settings-tab';
import { ReviewMode } from './src/review-mode';

export default class UnreadPlusPlugin extends Plugin {
  stateManager!: StateManager;
  badgeRenderer!: BadgeRenderer;
  reviewMode!: ReviewMode;

  private autoReadTimers = new Map<string, number>();
  private recentlyRenamedPaths = new Set<string>();
  private sessionOpenedPaths = new Set<string>();
  private isLayoutReady = false;
  private statusBarItem!: HTMLElement;
  private snoozeWakeupTimer: number | null = null;

  async onload(): Promise<void> {
    this.stateManager = new StateManager(this);
    await this.stateManager.load();

    this.badgeRenderer = new BadgeRenderer(this.app, this.stateManager);
    this.reviewMode = new ReviewMode();
    this.statusBarItem = this.addStatusBarItem();

    this.badgeRenderer.start();
    this.registerVaultEvents();
    this.registerWorkspaceEvents();
    this.registerCommands();
    this.registerContextMenu();

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload(): void {
    this.reviewMode.stop();
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach(t => window.clearTimeout(t));
    this.autoReadTimers.clear();
    if (this.snoozeWakeupTimer !== null) window.clearTimeout(this.snoozeWakeupTimer);
    this.stateManager.setKnownPaths(this.app.vault.getFiles().map(f => f.path));
    this.stateManager.setLastCloseTime(Date.now());
    this.stateManager.setLastOpenPaths([
      ...this.getOpenFilePaths(),
      ...this.sessionOpenedPaths,
    ]);
    void this.stateManager.flushSave();
  }

  private getOpenFilePaths(): Set<string> {
    const paths = new Set<string>();
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.view instanceof FileView && leaf.view.file) {
        paths.add(leaf.view.file.path);
      }
    });
    return paths;
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on('create', (file: TAbstractFile) => {
        if (!this.isLayoutReady) return;
        this.onFileCreated(file);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.isLayoutReady = true;
      // Capture files already open at startup in case file-open fired before our listener registered.
      for (const path of this.getOpenFilePaths()) this.sessionOpenedPaths.add(path);
      this.detectOfflineCreations();
    });

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) =>
        this.onFileRenamed(file, oldPath)
      )
    );

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => this.onFileDeleted(file))
    );
  }

  private registerWorkspaceEvents(): void {
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.badgeRenderer.refresh())
    );
    this.registerEvent(
      this.app.workspace.on('file-open', (file: TFile | null) => this.onFileOpen(file))
    );
  }

  private detectOfflineCreations(): void {
    this.stateManager.clearExpiredSnoozes();
    const known = this.stateManager.getKnownPaths();
    const lastClose = this.stateManager.getLastCloseTime();
    const lastOpen = this.stateManager.getLastOpenPaths();
    const currentFiles = this.app.vault.getFiles();

    const moved = this.stateManager.popMovedPaths();
    const isRecentlyMoved = (path: string) =>
      moved.some(p => path === p || path.startsWith(p + '/'));

    this.stateManager.pruneReadPaths(new Set(currentFiles.map(f => f.path)));

    const hasBaseline = known.size > 0 || lastClose > 0;

    if (hasBaseline) {
      for (const file of currentFiles) {
        if (this.stateManager.isIgnored(file.path)) continue;
        if (this.stateManager.getStatus(file.path)) continue;
        if (this.stateManager.isExplicitlyRead(file.path)) continue;
        if (isRecentlyMoved(file.path)) continue;

        const isNewPath =
          known.size > 0 && !known.has(file.path) &&
          lastClose > 0 && file.stat.mtime > lastClose;
        const isModifiedOffline =
          lastClose > 0 && file.stat.mtime > lastClose && !lastOpen.has(file.path);

        if (isNewPath || isModifiedOffline) {
          this.stateManager.setStatus(file.path, 'unread');
        }
      }
    }

    if (currentFiles.length > 0) {
      this.stateManager.setKnownPaths(currentFiles.map(f => f.path));
      this.stateManager.scheduleSave();
    }

    this.scheduleSnoozeWakeup();
    window.setTimeout(() => this.refreshUI(), 150);
  }

  private onFileCreated(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;
    if (this.getOpenFilePaths().has(file.path)) return;
    if (this.stateManager.isExplicitlyRead(file.path)) return;
    if (this.isUnderRecentlyRenamedPath(file.path)) return;
    // Obsidian fires a second wave of 'create' events for pre-existing files after
    // onLayoutReady (continued vault indexing). By that point detectOfflineCreations
    // has already called setKnownPaths, so any file that existed at last shutdown is
    // in knownPaths — treat those creates as spurious and skip them.
    if (this.stateManager.getKnownPaths().has(file.path)) return;

    // Obsidian opens freshly created notes in a leaf shortly after emitting 'create',
    // so re-check after a tick to avoid briefly flashing user-created notes as unread.
    window.setTimeout(() => {
      if (this.getOpenFilePaths().has(file.path)) return;
      if (this.stateManager.isExplicitlyRead(file.path)) return;
      if (this.isUnderRecentlyRenamedPath(file.path)) return;
      if (this.stateManager.getKnownPaths().has(file.path)) return;
      this.stateManager.setStatus(file.path, 'unread');
      this.stateManager.scheduleSave();
      this.refreshUI();
    }, 150);
  }

  private onFileRenamed(file: TAbstractFile, oldPath: string): void {
    for (const p of [...this.sessionOpenedPaths]) {
      if (p === oldPath || p.startsWith(oldPath + '/')) {
        this.sessionOpenedPaths.delete(p);
        this.sessionOpenedPaths.add(file.path + p.slice(oldPath.length));
      }
    }

    const hadStatusBefore = this.stateManager.getStatus(oldPath);
    this.stateManager.renamePath(oldPath, file.path);

    // Undo any status that a spurious create-before-rename race may have applied.
    if (!hadStatusBefore) {
      const newStatus = this.stateManager.getStatus(file.path);
      if (newStatus) this.stateManager.clearStatus(file.path);
    }

    this.stateManager.addMovedPath(file.path);

    // Briefly suppress spurious creates that may arrive after this rename.
    this.recentlyRenamedPaths.add(file.path);
    window.setTimeout(() => this.recentlyRenamedPaths.delete(file.path), 1000);
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  private isUnderRecentlyRenamedPath(filePath: string): boolean {
    for (const p of this.recentlyRenamedPaths) {
      if (filePath === p || filePath.startsWith(p + '/')) return true;
    }
    return false;
  }

  private onFileDeleted(file: TAbstractFile): void {
    this.stateManager.deletePath(file.path);
    this.stateManager.scheduleSave();
    this.refreshUI();
  }

  private onFileOpen(file: TFile | null): void {
    if (!file) return;
    this.sessionOpenedPaths.add(file.path);

    const existing = this.autoReadTimers.get(file.path);
    if (existing) window.clearTimeout(existing);

    const seconds = this.stateManager.getSettings().autoReadSeconds;
    if (seconds <= 0) return;
    if (!this.stateManager.hasOpenStatus(file.path)) return;

    const timer = window.setTimeout(() => {
      this.stateManager.clearStatus(file.path);
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.autoReadTimers.delete(file.path);
    }, seconds * 1000);

    this.autoReadTimers.set(file.path, timer);
  }

  setFileStatus(path: string, statusId: string): void {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  setFilesStatus(files: TFile[], statusId: string): void {
    for (const file of files) {
      this.stateManager.setStatus(file.path, statusId);
    }
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  clearFileStatus(path: string): void {
    this.stateManager.clearStatus(path);
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  clearFilesStatus(files: TFile[]): void {
    for (const file of files) {
      this.stateManager.clearStatus(file.path);
    }
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'mark-all-read',
      name: 'Mark all as read',
      callback: () => {
        this.stateManager.clearAll();
        this.stateManager.save().catch(() => {});
        this.refreshUI();
      },
    });

    this.addCommand({
      id: 'mark-current-unread',
      name: 'Mark current file as unread',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.setFileStatus(file.path, 'unread');
        return true;
      },
    });

    this.addCommand({
      id: 'mark-folder-read',
      name: 'Mark all in current folder as read',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          const folder = file.parent?.path ?? '';
          for (const path of Object.keys(this.stateManager.getAllFileStatuses())) {
            const inFolder = folder === '' ? !path.includes('/') : path.startsWith(folder + '/');
            if (inFolder) this.stateManager.clearStatus(path);
          }
          this.stateManager.save().catch(() => {});
          this.refreshUI();
        }
        return true;
      },
    });

    this.addCommand({
      id: 'open-next-unread',
      name: 'Open next unread',
      callback: () => {
        if (!this.reviewMode.isActive()) this.reviewMode.start(this.stateManager);
        void this.reviewMode.next(this.app, this.stateManager, this);
      },
    });

    this.addCommand({
      id: 'start-review',
      name: 'Restart queue from beginning',
      callback: () => {
        this.reviewMode.start(this.stateManager);
        void this.reviewMode.next(this.app, this.stateManager, this);
      },
    });

    this.addCommand({
      id: 'next-review',
      name: 'Next in review',
      checkCallback: (checking: boolean) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) void this.reviewMode.next(this.app, this.stateManager, this);
        return true;
      },
    });
  }

  private refreshUI(): void {
    this.badgeRenderer.refresh();
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const counts = this.stateManager.getOpenCounts();
    this.statusBarItem.empty();
    if (counts.length === 0) {
      this.statusBarItem.addClass('unread-plus-hidden');
      return;
    }
    this.statusBarItem.removeClass('unread-plus-hidden');
    for (const { config, count } of counts) {
      const span = this.statusBarItem.createSpan({ cls: 'unread-plus-status-bar-dot' });
      span.setCssStyles({ color: config.color });
      span.textContent = `${count}●`;
    }
  }

  private scheduleSnoozeWakeup(): void {
    if (this.snoozeWakeupTimer !== null) window.clearTimeout(this.snoozeWakeupTimer);
    const next = this.stateManager.nextSnoozeExpiry();
    if (next === null) return;
    const delay = Math.max(next - Date.now(), 0);
    this.snoozeWakeupTimer = window.setTimeout(() => {
      this.snoozeWakeupTimer = null;
      this.stateManager.clearExpiredSnoozes();
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.scheduleSnoozeWakeup();
    }, delay);
  }

  private makeMenuDot(color: string, char = '●'): HTMLSpanElement {
    const span = activeDocument.createElement('span');
    span.textContent = char + ' ';
    span.setCssStyles({ color, fontSize: '10px', marginRight: '2px' });
    return span;
  }

  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on('files-menu', (menu, files: TAbstractFile[]) => {
        const selectedFiles = files.filter((file): file is TFile =>
          file instanceof TFile && !this.stateManager.isIgnored(file.path)
        );
        if (selectedFiles.length === 0) return;

        const unreadConfig = this.stateManager.getStatusConfig('unread');

        menu.addSeparator();

        if (unreadConfig) {
          menu.addItem(item => {
            const frag = activeDocument.createDocumentFragment();
            frag.appendChild(this.makeMenuDot(unreadConfig.color));
            frag.appendChild(activeDocument.createTextNode('Mark selected as Unread'));
            item.setTitle(frag).onClick(() => this.setFilesStatus(selectedFiles, unreadConfig.id));
          });
        }

        menu.addItem(item =>
          item.setTitle('Mark selected as read').setIcon('check-circle')
            .onClick(() => this.clearFilesStatus(selectedFiles))
        );
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile)) return;

        const configs = this.stateManager.getStatusConfigs();
        const current = this.stateManager.getStatus(file.path);

        menu.addSeparator();

        for (const config of configs) {
          if (current?.statusId === config.id) continue;
          menu.addItem(item => {
            const frag = activeDocument.createDocumentFragment();
            frag.appendChild(this.makeMenuDot(config.color));
            frag.appendChild(activeDocument.createTextNode(config.label));
            item.setTitle(frag).onClick(() => this.setFileStatus(file.path, config.id));
          });
        }

        if (current) {
          const currentConfig = configs.find(c => c.id === current.statusId);

          if (this.stateManager.isSnoozed(file.path)) {
            menu.addItem(item =>
              item.setTitle('Unsnooze').setIcon('bell')
                .onClick(() => {
                  this.stateManager.clearSnooze(file.path);
                  this.stateManager.save().catch(() => {});
                  this.scheduleSnoozeWakeup();
                  this.refreshUI();
                })
            );
          } else {
            menu.addSeparator();
            for (const [label, days] of [['Snooze 1 day', 1], ['Snooze 3 days', 3], ['Snooze 1 week', 7]] as const) {
              menu.addItem(item =>
                item.setTitle(label).setIcon('clock')
                  .onClick(() => {
                    this.stateManager.snooze(file.path, days * 86_400_000);
                    this.stateManager.save().catch(() => {});
                    this.scheduleSnoozeWakeup();
                    this.refreshUI();
                  })
              );
            }
          }

          menu.addSeparator();
          menu.addItem(item => {
            const frag = activeDocument.createDocumentFragment();
            if (currentConfig) frag.appendChild(this.makeMenuDot(currentConfig.color, '○'));
            frag.appendChild(activeDocument.createTextNode('Mark as read'));
            item.setTitle(frag).onClick(() => this.clearFileStatus(file.path));
          });
        }
      })
    );
  }
}
