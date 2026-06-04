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
  }

  clearStatus(path: string): void {
    delete this.data.fileStatuses[path];
  }

  getStatus(path: string): FileStatus | undefined {
    return this.data.fileStatuses[path];
  }

  getAllFileStatuses(): Record<string, FileStatus> {
    return { ...this.data.fileStatuses };
  }

  hasOpenStatus(path: string): boolean {
    const status = this.getStatus(path);
    if (!status) return false;
    return this.getStatusConfig(status.statusId)?.countsAsOpen ?? false;
  }

  renamePath(oldPath: string, newPath: string): void {
    const entries = Object.entries(this.data.fileStatuses);
    for (const [path, status] of entries) {
      if (path === oldPath || path.startsWith(oldPath + '/')) {
        const updated = newPath + path.slice(oldPath.length);
        delete this.data.fileStatuses[path];
        this.data.fileStatuses[updated] = status;
      }
    }
  }

  deletePath(path: string): void {
    for (const key of Object.keys(this.data.fileStatuses)) {
      if (key === path || key.startsWith(path + '/')) {
        delete this.data.fileStatuses[key];
      }
    }
  }

  clearAll(): void {
    this.data.fileStatuses = {};
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
