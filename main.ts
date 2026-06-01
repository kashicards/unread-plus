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
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach(t => clearTimeout(t));
    this.autoReadTimers.clear();
    await this.stateManager.save();
  }

  private registerVaultEvents(): void {
    // Only listen to create events after layout is ready to skip initial vault scan
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on('create', (file: TAbstractFile) => this.onFileCreated(file))
      );
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
            if (path.startsWith(folder + '/') || path === folder) {
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
      id: 'start-review',
      name: 'Start review',
      checkCallback: (checking: boolean) => {
        if (!this.stateManager.getSettings().reviewEnabled) return false;
        if (!checking) {
          this.reviewMode.start(this.stateManager);
          this.reviewMode.next(this.app, this.stateManager, this);
        }
        return true;
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
        const configs = this.stateManager.getStatusConfigs();
        const current = this.stateManager.getStatus(file.path);

        menu.addSeparator();

        for (const config of configs) {
          if (current?.statusId === config.id) continue;
          menu.addItem(item =>
            item
              .setTitle(`Mark as ${config.label}`)
              .setIcon('circle')
              .onClick(() => this.setFileStatus(file.path, config.id))
          );
        }

        if (current) {
          menu.addItem(item =>
            item
              .setTitle('Mark as read')
              .setIcon('check')
              .onClick(() => this.clearFileStatus(file.path))
          );
        }
      })
    );
  }
}
