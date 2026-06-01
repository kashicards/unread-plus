import { App } from 'obsidian';
import { StateManager } from './state-manager';
import { computeFolderCounts } from './folder-counter';

export class BadgeRenderer {
  private observer: MutationObserver | null = null;
  private isRendering = false;

  constructor(private app: App, private stateManager: StateManager) {}

  start(): void {
    this.app.workspace.onLayoutReady(() => {
      this.refresh();
      this.attachObserver();
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.clearAll();
  }

  refresh(): void {
    const container = this.getExplorerContainer();
    if (!container) return;

    this.isRendering = true;
    this.clearAll(container);
    this.renderFileDots(container);
    this.renderFolderBadges(container);
    this.isRendering = false;
  }

  private getExplorerContainer(): HTMLElement | null {
    const leaves = this.app.workspace.getLeavesOfType('file-explorer');
    return leaves.length > 0 ? (leaves[0].view as any).containerEl as HTMLElement : null;
  }

  private clearAll(container?: HTMLElement): void {
    const root = container ?? this.getExplorerContainer();
    if (!root) return;
    root.querySelectorAll('.unread-plus-dot, .unread-plus-folder-badge').forEach(el => el.remove());
  }

  private renderFileDots(container: HTMLElement): void {
    const configs = this.stateManager.getStatusConfigs();
    const configMap = new Map(configs.map(c => [c.id, c]));
    const settings = this.stateManager.getSettings();

    container.querySelectorAll<HTMLElement>('.nav-file-title[data-path]').forEach(titleEl => {
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const status = this.stateManager.getStatus(path);
      if (!status) return;

      const config = configMap.get(status.statusId);
      if (!config) return;

      const dot = document.createElement('span');
      dot.className = 'unread-plus-dot';
      dot.setAttribute('data-status', status.statusId);
      dot.style.setProperty('--dot-color', config.color);

      if (settings.badgeShowLabel) {
        dot.textContent = ` ${config.label}`;
      }

      titleEl.appendChild(dot);
    });
  }

  private renderFolderBadges(container: HTMLElement): void {
    const folderCounts = computeFolderCounts(
      this.stateManager.getAllFileStatuses(),
      this.stateManager.getStatusConfigs(),
    );

    container.querySelectorAll<HTMLElement>('.nav-folder-title[data-path]').forEach(titleEl => {
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const count = folderCounts.get(path);
      if (!count || count.total === 0) return;

      const badge = document.createElement('span');
      badge.className = 'unread-plus-folder-badge';
      badge.style.setProperty('--badge-color', count.dominantColor);
      badge.textContent = `${count.total}●`;
      titleEl.appendChild(badge);
    });
  }

  private attachObserver(): void {
    const container = this.getExplorerContainer();
    if (!container) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.observer = new MutationObserver(() => {
      if (this.isRendering) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.refresh(), 50);
    });

    this.observer.observe(container, { childList: true, subtree: true });
  }
}
