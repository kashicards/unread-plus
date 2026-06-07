import { Plugin } from 'obsidian';
import {
  PluginData, FileStatus, StatusConfig, UnreadPlusSettings, DEFAULT_DATA,
} from './types';

export class StateManager {
  private data: PluginData = structuredClone(DEFAULT_DATA);

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    const saved = await this.plugin.loadData();
    if (!saved) return;
    this.data = {
      ...DEFAULT_DATA,
      ...saved,
      settings: { ...DEFAULT_DATA.settings, ...saved.settings },
      statusConfigs: saved.statusConfigs ?? DEFAULT_DATA.statusConfigs,
      fileStatuses: saved.fileStatuses ?? {},
      knownPaths: saved.knownPaths ?? [],
      lastCloseTime: saved.lastCloseTime ?? 0,
      readPaths: saved.readPaths ?? [],
      lastOpenPaths: saved.lastOpenPaths ?? [],
    };
    this.migrate();
  }

  private migrate(): void {
    // v1 → v2: change default unread orange to blue
    if ((this.data.version ?? 1) < 2) {
      const unread = this.data.statusConfigs.find(s => s.id === 'unread');
      if (unread && unread.color === '#FA6300') unread.color = '#4285F4';
      this.data.version = 2;
    }
    // v2 → v3: add json to ignoreExtensions
    if (this.data.version < 3) {
      if (!this.data.settings.ignoreExtensions.includes('json')) {
        this.data.settings.ignoreExtensions.push('json');
      }
      this.data.version = 3;
    }
    // v3 → v4: replace skip+review presets with "later" (orange); fix queue filter
    if (this.data.version < 4) {
      const ids = this.data.statusConfigs.map(s => s.id);
      if (ids.includes('skip') || ids.includes('review')) {
        this.data.statusConfigs = this.data.statusConfigs.filter(
          s => s.id !== 'skip' && s.id !== 'review'
        );
        if (!ids.includes('later')) {
          this.data.statusConfigs.push({ id: 'later', label: 'Later', color: '#FF8C00', countsAsOpen: true });
        }
      }
      this.data.version = 4;
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounced write — coalesces rapid successive mutations into one disk write.
  scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.plugin.saveData(this.data).catch(() => {});
    }, 300);
  }

  // Flush any pending debounced write immediately (used on unload).
  async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.plugin.saveData(this.data);
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  // --- File status ---

  setStatus(path: string, statusId: string): void {
    this.data.fileStatuses[path] = { statusId, markedAt: Date.now() };
    // Remove from readPaths when explicitly re-marked
    const idx = this.data.readPaths.indexOf(path);
    if (idx !== -1) this.data.readPaths.splice(idx, 1);
  }

  clearStatus(path: string): void {
    delete this.data.fileStatuses[path];
    // Track as explicitly read so detectOfflineCreations never re-marks it
    if (!this.data.readPaths.includes(path)) this.data.readPaths.push(path);
  }

  isExplicitlyRead(path: string): boolean {
    return this.data.readPaths.includes(path);
  }

  // Remove paths that no longer exist in the vault (called on startup)
  pruneReadPaths(validPaths: Set<string>): void {
    this.data.readPaths = this.data.readPaths.filter(p => validPaths.has(p));
  }

  getStatus(path: string): FileStatus | undefined {
    return this.data.fileStatuses[path];
  }

  getAllFileStatuses(): Record<string, FileStatus> {
    return { ...this.data.fileStatuses };
  }

  hasOpenStatus(path: string): boolean {
    if (this.isSnoozed(path)) return false;
    const status = this.getStatus(path);
    if (!status) return false;
    return this.getStatusConfig(status.statusId)?.countsAsOpen ?? false;
  }

  renamePath(oldPath: string, newPath: string): void {
    // fileStatuses
    for (const [path, status] of Object.entries(this.data.fileStatuses)) {
      if (path === oldPath || path.startsWith(oldPath + '/')) {
        const updated = newPath + path.slice(oldPath.length);
        delete this.data.fileStatuses[path];
        this.data.fileStatuses[updated] = status;
      }
    }
    // knownPaths — keep in sync so detectOfflineCreations doesn't see the new path as "new"
    for (let i = 0; i < this.data.knownPaths.length; i++) {
      const p = this.data.knownPaths[i];
      if (p === oldPath || p.startsWith(oldPath + '/')) {
        this.data.knownPaths[i] = newPath + p.slice(oldPath.length);
      }
    }
    // readPaths
    for (let i = 0; i < this.data.readPaths.length; i++) {
      const p = this.data.readPaths[i];
      if (p === oldPath || p.startsWith(oldPath + '/')) {
        this.data.readPaths[i] = newPath + p.slice(oldPath.length);
      }
    }
  }

  deletePath(path: string): void {
    for (const key of Object.keys(this.data.fileStatuses)) {
      if (key === path || key.startsWith(path + '/')) {
        delete this.data.fileStatuses[key];
      }
    }
    this.data.readPaths = this.data.readPaths.filter(
      p => p !== path && !p.startsWith(path + '/')
    );
  }

  clearAll(): void {
    this.data.fileStatuses = {};
  }

  // --- Snooze ---

  snooze(path: string, durationMs: number): void {
    const status = this.data.fileStatuses[path];
    if (status) {
      this.data.fileStatuses[path] = { ...status, snoozedUntil: Date.now() + durationMs };
    }
  }

  clearSnooze(path: string): void {
    const status = this.data.fileStatuses[path];
    if (status) {
      const { snoozedUntil: _, ...rest } = status;
      this.data.fileStatuses[path] = rest as FileStatus;
    }
  }

  isSnoozed(path: string): boolean {
    const s = this.data.fileStatuses[path];
    return !!s?.snoozedUntil && s.snoozedUntil > Date.now();
  }

  clearExpiredSnoozes(): void {
    const now = Date.now();
    for (const [path, status] of Object.entries(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil <= now) {
        const { snoozedUntil: _, ...rest } = status;
        this.data.fileStatuses[path] = rest as FileStatus;
      }
    }
  }

  nextSnoozeExpiry(): number | null {
    const now = Date.now();
    let earliest: number | null = null;
    for (const status of Object.values(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil > now) {
        if (earliest === null || status.snoozedUntil < earliest) earliest = status.snoozedUntil;
      }
    }
    return earliest;
  }

  // Returns per-status counts for all non-snoozed open files (used by status bar).
  getOpenCounts(): Array<{ config: StatusConfig; count: number }> {
    const now = Date.now();
    const counts = new Map<string, number>();
    for (const status of Object.values(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil > now) continue;
      if (!this.getStatusConfig(status.statusId)?.countsAsOpen) continue;
      counts.set(status.statusId, (counts.get(status.statusId) ?? 0) + 1);
    }
    return this.data.statusConfigs
      .filter(c => c.countsAsOpen && counts.has(c.id))
      .map(c => ({ config: c, count: counts.get(c.id)! }));
  }

  // --- Offline-creation snapshot ---

  getKnownPaths(): Set<string> {
    return new Set(this.data.knownPaths);
  }

  setKnownPaths(paths: string[]): void {
    this.data.knownPaths = paths;
  }

  getLastCloseTime(): number {
    return this.data.lastCloseTime;
  }

  setLastCloseTime(ts: number): void {
    this.data.lastCloseTime = ts;
  }

  getLastOpenPaths(): Set<string> {
    return new Set(this.data.lastOpenPaths);
  }

  setLastOpenPaths(paths: string[]): void {
    this.data.lastOpenPaths = paths;
  }

  // --- Status configs ---

  getStatusConfigs(): StatusConfig[] {
    return [...this.data.statusConfigs];
  }

  getStatusConfig(id: string): StatusConfig | undefined {
    return this.data.statusConfigs.find(s => s.id === id);
  }

  updateStatusConfigs(configs: StatusConfig[]): void {
    this.data.statusConfigs = configs;
  }

  // --- Settings ---

  getSettings(): UnreadPlusSettings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<UnreadPlusSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
  }

  // --- Ignore ---

  isIgnored(path: string): boolean {
    const { ignorePaths, ignoreExtensions } = this.data.settings;
    if (ignorePaths.some(p => path === p || path.startsWith(p + '/'))) return true;
    const basename = path.split('/').pop() ?? '';
    const ext = basename.includes('.') ? basename.split('.').pop()! : '';
    return ignoreExtensions.includes(ext);
  }
}
