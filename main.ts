import { Plugin, TAbstractFile, TFile } from 'obsidian';
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

  async onload(): Promise<void> {
    this.stateManager = new StateManager(this);
    await this.stateManager.load();

    this.badgeRenderer = new BadgeRenderer(this.app, this.stateManager);
    this.reviewMode = new ReviewMode();

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
    this.stateManager.setKnownPaths(this.app.vault.getFiles().map(f => f.path));
    this.stateManager.setLastCloseTime(Date.now());
    await this.stateManager.save();
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
      this.app.workspace.on('layout-change', () => {
        this.badgeRenderer.tryAttachObserver();
        this.badgeRenderer.refresh();
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-open', (file: TFile | null) => this.onFileOpen(file))
    );
  }

  private detectOfflineCreations(): void {
    const known = this.stateManager.getKnownPaths();
    const lastClose = this.stateManager.getLastCloseTime();
    const currentFiles = this.app.vault.getFiles();

    console.log(`[Unread+] detectOfflineCreations: known=${known.size} lastClose=${lastClose} current=${currentFiles.length}`);

    const hasBaseline = known.size > 0 || lastClose > 0;

    if (hasBaseline) {
      for (const file of currentFiles) {
        if (this.stateManager.isIgnored(file.path)) continue;
        if (this.stateManager.getStatus(file.path)) continue;

        const isNewPath = known.size > 0 && !known.has(file.path);
        // Also catch files that were overwritten while Obsidian was closed
        // (same path but mtime is after the last clean close).
        const isModifiedOffline = lastClose > 0 && file.stat.mtime > lastClose;

        if (isNewPath || isModifiedOffline) {
          console.log(`[Unread+] Offline change: ${file.path} (new=${isNewPath} modified=${isModifiedOffline})`);
          this.stateManager.setStatus(file.path, 'unread');
        }
      }
    } else {
      console.log('[Unread+] No baseline yet — skipping offline detection');
    }

    if (currentFiles.length > 0) {
      this.stateManager.setKnownPaths(currentFiles.map(f => f.path));
      this.stateManager.save();
    }

    setTimeout(() => this.badgeRenderer.refresh(), 150);
  }

  private onFileCreated(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;

    this.stateManager.setStatus(file.path, 'unread');
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private onFileRenamed(file: TAbstractFile, oldPath: string): void {
    this.stateManager.renamePath(oldPath, file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private onFileDeleted(file: TAbstractFile): void {
    this.stateManager.deletePath(file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
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
      this.stateManager.save();
      this.badgeRenderer.refresh();
      this.autoReadTimers.delete(file.path);
    }, seconds * 1000);

    this.autoReadTimers.set(file.path, timer);
  }

  // Called by context menu and commands
  setFileStatus(path: string, statusId: string): void {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  clearFileStatus(path: string): void {
    this.stateManager.clearStatus(path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'mark-all-read',
      name: 'Mark all as read',
      callback: () => {
        this.stateManager.clearAll();
        this.stateManager.save();
        this.badgeRenderer.refresh();
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
          this.stateManager.save();
          this.badgeRenderer.refresh();
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
            const dot = document.createElement('span');
            dot.textContent = '● ';
            dot.style.cssText = `color:${config.color};font-size:10px;margin-right:2px;`;
            frag.appendChild(dot);
            frag.appendChild(document.createTextNode(config.label));
            item
              .setTitle(frag)
              .onClick(() => this.setFileStatus(file.path, config.id));
          });
        }

        if (current) {
          const currentConfig = configs.find(c => c.id === current.statusId);
          menu.addItem(item => {
            const frag = document.createDocumentFragment();
            if (currentConfig) {
              const dot = document.createElement('span');
              dot.textContent = '○ ';
              dot.style.cssText = `color:${currentConfig.color};font-size:10px;margin-right:2px;`;
              frag.appendChild(dot);
            }
            frag.appendChild(document.createTextNode('Mark as read'));
            item
              .setTitle(frag)
              .onClick(() => this.clearFileStatus(file.path));
          });
        }
      })
    );
  }
}
