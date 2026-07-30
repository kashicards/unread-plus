import { App, MarkdownRenderChild, TFile } from 'obsidian';
import { StateManager } from './state-manager';
import { OverviewParams } from './overview-params';
import { selectOverviewEntries, computeOverviewStats } from './overview-data';
import type UnreadPlusPlugin from '../main';

export class OverviewBlockChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private app: App,
    private stateManager: StateManager,
    private plugin: UnreadPlusPlugin,
    private params: OverviewParams,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.render();
    this.plugin.registerOverviewRefresh(this.refresh);
  }

  onunload(): void {
    this.plugin.unregisterOverviewRefresh(this.refresh);
  }

  private refresh = (): void => {
    this.render();
  };

  private render(): void {
    const { containerEl, stateManager, params } = this;
    containerEl.empty();
    containerEl.addClass('unread-plus-overview');

    const configs = stateManager.getStatusConfigs();
    const openConfigIds = configs.filter(c => c.countsAsOpen).map(c => c.id);
    const allowedStatusIds = new Set(params.statusIds ?? openConfigIds);

    const entries = selectOverviewEntries(
      stateManager.getAllFileStatuses(),
      (path) => stateManager.isSnoozed(path),
      params,
      allowedStatusIds,
    );

    if (params.showStats) {
      this.renderStats(entries, configs);
    }

    if (params.showList) {
      this.renderList(entries.slice(0, params.limit));
    }

    if (entries.length === 0) {
      containerEl.createDiv({ cls: 'unread-plus-overview-empty', text: 'All clear ✓' });
    }
  }

  private renderStats(entries: ReturnType<typeof selectOverviewEntries>, configs: ReturnType<StateManager['getStatusConfigs']>): void {
    const stats = computeOverviewStats(entries, configs);
    if (stats.length === 0) return;

    const statsEl = this.containerEl.createDiv({ cls: 'unread-plus-overview-stats' });
    for (const { config, count } of stats) {
      const chip = statsEl.createSpan({ cls: 'unread-plus-overview-chip' });
      const dot = chip.createSpan({ cls: 'unread-plus-overview-dot' });
      dot.setCssStyles({ color: config.color });
      chip.createSpan({ text: ` ${count} ${config.label}` });
    }
  }

  private renderList(entries: ReturnType<typeof selectOverviewEntries>): void {
    if (entries.length === 0) return;

    const listEl = this.containerEl.createEl('ul', { cls: 'unread-plus-overview-list' });
    for (const [path, status] of entries) {
      const config = this.stateManager.getStatusConfig(status.statusId);
      const item = listEl.createEl('li');
      const dot = item.createSpan({ cls: 'unread-plus-overview-dot' });
      if (config) dot.setCssStyles({ color: config.color });
      const link = item.createEl('a', { text: path, cls: 'unread-plus-overview-link' });
      link.addEventListener('click', (evt) => {
        evt.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          void this.app.workspace.getLeaf(false).openFile(file);
        }
      });
    }
  }
}
