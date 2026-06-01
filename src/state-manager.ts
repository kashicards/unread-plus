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
