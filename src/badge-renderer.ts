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
    if (this.isRendering) return;
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
    if (leaves.length === 0) return null;
    const view = leaves[0].view as { containerEl?: HTMLElement };
    return view.containerEl ?? null;
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
      if (this.stateManager.isSnoozed(path)) return;

      const config = configMap.get(status.statusId);
      if (!config) return;

      const dot = document.createElement('span');
      dot.className = 'unread-plus-dot';
      dot.setAttribute('data-status', status.statusId);
      dot.style.setProperty('--dot-color', config.color);

      if (settings.dotAging) {
        const ageDays = (Date.now() - status.markedAt) / 86_400_000;
        dot.style.opacity = String(Math.max(1 - ageDays * 0.1, 0.4).toFixed(2));
      }

      if (settings.badgeShowLabel) {
        dot.setAttribute('data-label', config.label);
      }

      titleEl.appendChild(dot);
    });
  }

  private renderFolderBadges(container: HTMLElement): void {
    const allStatuses = this.stateManager.getAllFileStatuses();
    const activeStatuses = Object.fromEntries(
      Object.entries(allStatuses).filter(([path]) =>
        !this.stateManager.isSnoozed(path)
      )
    );
    const folderCounts = computeFolderCounts(activeStatuses, this.stateManager.getStatusConfigs());

    container.querySelectorAll<HTMLElement>('.nav-folder-title[data-path]').forEach(titleEl => {
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const count = folderCounts.get(path);
      if (!count || count.segments.length === 0) return;

      const badge = document.createElement('span');
      badge.className = 'unread-plus-folder-badge';
      for (const seg of count.segments) {
        const span = document.createElement('span');
        span.textContent = `${seg.count}●`;
        span.style.color = seg.color;
        badge.appendChild(span);
      }
      titleEl.appendChild(badge);
    });
  }

  private attachObserver(): void {
    const container = this.getExplorerContainer();
    if (!container) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.observer = new MutationObserver((mutations) => {
      if (this.isRendering) return;
      // Ignore mutations caused entirely by our own injected elements —
      // otherwise adding dots triggers a re-render which adds dots which triggers...
      const isOwnChange = mutations.every(m => {
        const isOwnNode = (n: Node) =>
          n instanceof Element &&
          (n.classList.contains('unread-plus-dot') ||
           n.classList.contains('unread-plus-folder-badge'));
        return (
          Array.from(m.addedNodes).every(isOwnNode) &&
          Array.from(m.removedNodes).every(isOwnNode)
        );
      });
      if (isOwnChange) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.refresh(), 50);
    });

    this.observer.observe(container, { childList: true, subtree: true });
  }
}
