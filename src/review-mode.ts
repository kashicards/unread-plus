import { App, Notice, TFile } from 'obsidian';
import { StateManager } from './state-manager';
import { sortEntries } from './sort-entries';
import type UnreadPlusPlugin from '../main';

export class ReviewMode {
  private queue: string[] = [];
  private index = -1;
  private active = false;
  private autoMarkTimer: number | null = null;

  isActive(): boolean {
    return this.active;
  }

  start(stateManager: StateManager): void {
    const settings = stateManager.getSettings();
    const statuses = stateManager.getAllFileStatuses();
    const openIds = new Set(
      stateManager.getStatusConfigs().filter(c => c.countsAsOpen).map(c => c.id)
    );

    let entries = Object.entries(statuses).filter(([, s]) => openIds.has(s.statusId));

    entries = sortEntries(entries, settings.reviewOrder);

    this.queue = entries.map(([path]) => path);
    this.index = -1;
    this.active = this.queue.length > 0;

    if (!this.active) {
      new Notice('Unread+: All clear ✓');
    }
  }

  async next(app: App, stateManager: StateManager, plugin: UnreadPlusPlugin): Promise<void> {
    if (!this.active) return;

    while (true) {
      this.index++;

      if (this.index >= this.queue.length) {
        this.stop();
        new Notice('Unread+: All clear ✓');
        return;
      }

      const path = this.queue[this.index];
      const file = app.vault.getAbstractFileByPath(path);

      if (!(file instanceof TFile)) {
        continue; // skip deleted files, try next
      }

      await app.workspace.getLeaf(false).openFile(file);

      const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
      if (seconds > 0) {
        if (this.autoMarkTimer !== null) window.clearTimeout(this.autoMarkTimer);
        this.autoMarkTimer = window.setTimeout(() => {
          plugin.clearFileStatus(path);
          this.autoMarkTimer = null;
        }, seconds * 1000);
      }

      return;
    }
  }

  stop(): void {
    if (this.autoMarkTimer !== null) {
      window.clearTimeout(this.autoMarkTimer);
      this.autoMarkTimer = null;
    }
    this.active = false;
    this.queue = [];
    this.index = -1;
  }
}
