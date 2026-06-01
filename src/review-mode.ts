import { App, Notice, TFile } from 'obsidian';
import { StateManager } from './state-manager';
import type UnreadPlusPlugin from '../main';

export class ReviewMode {
  private queue: string[] = [];
  private index = -1;
  private active = false;

  isActive(): boolean {
    return this.active;
  }

  start(stateManager: StateManager): void {
    const settings = stateManager.getSettings();
    const statuses = stateManager.getAllFileStatuses();
    const filterIds = new Set(settings.reviewStatusFilter);

    let entries = Object.entries(statuses).filter(([, s]) => filterIds.has(s.statusId));

    if (settings.reviewOrder === 'created') {
      entries.sort((a, b) => a[1].markedAt - b[1].markedAt);
    } else if (settings.reviewOrder === 'folder') {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      // random
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
    }

    this.queue = entries.map(([path]) => path);
    this.index = -1;
    this.active = this.queue.length > 0;

    if (!this.active) {
      new Notice('Unread+: All clear ✓');
    }
  }

  async next(app: App, stateManager: StateManager, plugin: UnreadPlusPlugin): Promise<void> {
    if (!this.active) return;

    this.index++;

    if (this.index >= this.queue.length) {
      this.active = false;
      this.queue = [];
      new Notice('Unread+: All clear ✓');
      return;
    }

    const path = this.queue[this.index];
    const file = app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      // file was deleted since queue was built — skip
      await this.next(app, stateManager, plugin);
      return;
    }

    await app.workspace.getLeaf(false).openFile(file);

    const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
    if (seconds > 0) {
      setTimeout(() => {
        plugin.clearFileStatus(path);
      }, seconds * 1000);
    }
  }

  stop(): void {
    this.active = false;
    this.queue = [];
    this.index = -1;
  }
}
