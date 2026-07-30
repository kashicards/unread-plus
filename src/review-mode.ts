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

      if (await this.tryOpenCurrent(app, stateManager, plugin)) return;
    }
  }

  async previous(app: App, stateManager: StateManager, plugin: UnreadPlusPlugin): Promise<void> {
    if (!this.active) return;

    while (true) {
      if (this.index <= 0) {
        new Notice('Unread+: Already at the first file');
        return;
      }
      this.index--;

      if (await this.tryOpenCurrent(app, stateManager, plugin)) return;
    }
  }

  // Opens the file at the current index and starts the auto-mark timer if
  // configured. Returns false (without touching this.index) if the file at
  // this index no longer exists, so next()/previous() can keep stepping.
  private async tryOpenCurrent(app: App, stateManager: StateManager, plugin: UnreadPlusPlugin): Promise<boolean> {
    const path = this.queue[this.index];
    const file = app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      return false; // skip deleted files, caller tries the next index
    }

    await app.workspace.getLeaf(false).openFile(file);
    new Notice(`Unread+: ${this.index + 1} von ${this.queue.length}`);

    const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
    if (seconds > 0) {
      if (this.autoMarkTimer !== null) window.clearTimeout(this.autoMarkTimer);
      this.autoMarkTimer = window.setTimeout(() => {
        plugin.clearFileStatus(path);
        this.autoMarkTimer = null;
      }, seconds * 1000);
    }

    return true;
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
