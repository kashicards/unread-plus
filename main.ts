import { FileView, Plugin, TAbstractFile, TFile } from 'obsidian';
import { StateManager } from './src/state-manager';
import { BadgeRenderer } from './src/badge-renderer';
import { SettingsTab } from './src/settings-tab';
import { ReviewMode } from './src/review-mode';

export default class UnreadPlusPlugin extends Plugin {
  stateManager!: StateManager;
  badgeRenderer!: BadgeRenderer;
  reviewMode!: ReviewMode;

  private autoReadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private isLayoutReady = false;
  private statusBarItem!: HTMLElement;
  private snoozeWakeupTimer: ReturnType<typeof setTimeout> | null = null;

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

  async onunload(): Promise<void> {
    this.reviewMode.stop();
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach(t => clearTimeout(t));
    this.autoReadTimers.clear();
    if (this.snoozeWakeupTimer !== null) clearTimeout(this.snoozeWakeupTimer);
    this.stateManager.setKnownPaths(this.app.vault.getFiles().map(f => f.path));
    this.stateManager.setLastCloseTime(Date.now());
    this.stateManager.setLastOpenPaths([...this.getOpenFilePaths()]);
    await this.stateManager.flushSave();
  }

  // Paths currently visible in any leaf — files the user was actively viewing/editing.
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
    // Register immediately so external file creations (e.g. from scripts) are not missed.
    // isLayoutReady guards against marking the entire vault on initial load.
    this.registerEvent(
      this.app.vault.on('create', (file: TAbstractFile) => {
        if (!this.isLayoutReady) return;
        this.onFileCreated(file);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.isLayoutReady = true;
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

    // Prune readPaths to only existing files before using them
    const currentPathSet = new Set(currentFiles.map(f => f.path));
    this.stateManager.pruneReadPaths(currentPathSet);

    const hasBaseline = known.size > 0 || lastClose > 0;

    if (hasBaseline) {
      for (const file of currentFiles) {
        if (this.stateManager.isIgnored(file.path)) continue;
        if (this.stateManager.getStatus(file.path)) continue;
        // Never re-mark files the user explicitly read — survives mtime race conditions
        if (this.stateManager.isExplicitlyRead(file.path)) continue;

        const isNewPath = known.size > 0 && !known.has(file.path);
        // Files open at last shutdown were being read/edited by the user — a trailing
        // save flushing after lastCloseTime is captured shouldn't make them "unread".
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
    setTimeout(() => this.refreshUI(), 150);
  }

  private onFileCreated(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;
    if (this.app.workspace.getActiveFile()?.path === file.path) return;
    // Obsidian re-emits 'create' for pre-existing files while it finishes indexing
    // a vault after startup (the isLayoutReady gate doesn't cover this). Without this
    // check, a file the user explicitly marked read would flip back to unread on reopen.
    if (this.stateManager.isExplicitlyRead(file.path)) return;

    // Obsidian commonly opens a freshly created file in a leaf shortly after
    // emitting 'create' (e.g. "New note"), so re-check before marking unread —
    // otherwise self-created files briefly flash as unread.
    setTimeout(() => {
      if (this.app.workspace.getActiveFile()?.path === file.path) return;
      if (this.stateManager.isExplicitlyRead(file.path)) return;
      this.stateManager.setStatus(file.path, 'unread');
      this.stateManager.scheduleSave();
      this.refreshUI();
    }, 150);
  }

  private onFileRenamed(file: TAbstractFile, oldPath: string): void {
    this.stateManager.renamePath(oldPath, file.path);
    this.stateManager.scheduleSave();
    this.refreshUI();
  }

  private onFileDeleted(file: TAbstractFile): void {
    this.stateManager.deletePath(file.path);
    this.stateManager.scheduleSave();
    this.refreshUI();
  }

  private onFileOpen(file: TFile | null): void {
    if (!file) return;

    // Cancel any existing timer for this file
    const existing = this.autoReadTimers.get(file.path);
    if (existing) clearTimeout(existing);

    const seconds = this.stateManager.getSettings().autoReadSeconds;
    if (seconds <= 0) return;
    if (!this.stateManager.hasOpenStatus(file.path)) return;

    const timer = setTimeout(() => {
      this.stateManager.clearStatus(file.path);
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.autoReadTimers.delete(file.path);
    }, seconds * 1000);

    this.autoReadTimers.set(file.path, timer);
  }

  // Called by context menu and commands — save immediately so close-timing races don't lose the change
  setFileStatus(path: string, statusId: string): void {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save().catch(() => {});
    this.refreshUI();
  }

  clearFileStatus(path: string): void {
    this.stateManager.clearStatus(path);
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
        if (!checking) {
          this.setFileStatus(file.path, 'unread');
        }
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
          const statuses = this.stateManager.getAllFileStatuses();
          for (const path of Object.keys(statuses)) {
            const inFolder = folder === ''
              ? !path.includes('/')
              : path.startsWith(folder + '/');
            if (inFolder) {
              this.stateManager.clearStatus(path);
            }
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
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'U' }],
      callback: () => {
        if (!this.reviewMode.isActive()) {
          this.reviewMode.start(this.stateManager);
        }
        this.reviewMode.next(this.app, this.stateManager, this);
      },
    });

    this.addCommand({
      id: 'start-review',
      name: 'Restart queue from beginning',
      callback: () => {
        this.reviewMode.start(this.stateManager);
        this.reviewMode.next(this.app, this.stateManager, this);
      },
    });

    this.addCommand({
      id: 'next-review',
      name: 'Next in review',
      checkCallback: (checking: boolean) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) {
          this.reviewMode.next(this.app, this.stateManager, this);
        }
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
      this.statusBarItem.style.display = 'none';
      return;
    }
    this.statusBarItem.style.display = '';
    for (const { config, count } of counts) {
      const span = this.statusBarItem.createSpan();
      span.style.color = config.color;
      span.style.marginRight = '6px';
      span.textContent = `${count}●`;
    }
  }

  private scheduleSnoozeWakeup(): void {
    if (this.snoozeWakeupTimer !== null) clearTimeout(this.snoozeWakeupTimer);
    const next = this.stateManager.nextSnoozeExpiry();
    if (next === null) return;
    const delay = Math.max(next - Date.now(), 0);
    this.snoozeWakeupTimer = setTimeout(() => {
      this.snoozeWakeupTimer = null;
      this.stateManager.clearExpiredSnoozes();
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.scheduleSnoozeWakeup();
    }, delay);
  }

  private makeMenuDot(color: string, char = '●'): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = char + ' ';
    span.style.color = color;
    span.style.fontSize = '10px';
    span.style.marginRight = '2px';
    return span;
  }

  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile)) return;

        const configs = this.stateManager.getStatusConfigs();
        const current = this.stateManager.getStatus(file.path);

        menu.addSeparator();

        for (const config of configs) {
          if (current?.statusId === config.id) continue;
          menu.addItem(item => {
            const frag = document.createDocumentFragment();
            frag.appendChild(this.makeMenuDot(config.color));
            frag.appendChild(document.createTextNode(config.label));
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
            const frag = document.createDocumentFragment();
            if (currentConfig) frag.appendChild(this.makeMenuDot(currentConfig.color, '○'));
            frag.appendChild(document.createTextNode('Mark as read'));
            item.setTitle(frag).onClick(() => this.clearFileStatus(file.path));
          });
        }
      })
    );
  }
}
