import { afterEach, describe, expect, it, vi } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import { StateManager } from '../src/state-manager';
import { DEFAULT_DATA, PluginData } from '../src/types';
import UnreadPlusPlugin from '../main.ts';

function savedState(markdownOnly = true): PluginData {
  return {
    ...structuredClone(DEFAULT_DATA),
    settings: { ...DEFAULT_DATA.settings, markdownOnly },
    fileStatuses: {
      'notes/a.md': { statusId: 'later', markedAt: 123, snoozedUntil: 456 },
      'notes/B.MD': { statusId: 'unread', markedAt: 789 },
      'assets/paper.pdf': { statusId: 'unread', markedAt: 111 },
      'scripts/job.py': { statusId: 'later', markedAt: 222 },
    },
    knownPaths: ['notes/a.md', 'notes/B.MD', 'assets/paper.pdf', 'scripts/job.py'],
    readPaths: ['notes/read.md', 'assets/read.png'],
    lastOpenPaths: ['notes/open.md', 'logs/debug.log'],
    movedPaths: ['notes/renamed', 'notes/moved.md', 'assets/moved.pdf', 'missing-folder'],
    lastCloseTime: 100,
  };
}

async function makeManager(saved: PluginData | null = null) {
  const folder = new TFolder();
  folder.path = 'notes/renamed';
  const saveData = vi.fn(async (_data: PluginData) => {});
  const plugin = {
    app: { vault: { getAbstractFileByPath: (path: string) => path === folder.path ? folder : null } },
    loadData: async () => structuredClone(saved),
    saveData,
  };
  const manager = new StateManager(plugin as any);
  await manager.load();
  return { manager, saveData };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Markdown-only reading state', () => {
  it('preserves existing all-file behavior for fresh and legacy settings', async () => {
    const { manager: fresh } = await makeManager();
    expect(fresh.getSettings().markdownOnly).toBe(false);
    const legacy = savedState(false);
    delete (legacy.settings as Partial<typeof legacy.settings>).markdownOnly;
    const { manager, saveData } = await makeManager(legacy);
    expect(manager.getSettings().markdownOnly).toBe(false);
    manager.setStatus('new.pdf', 'later');
    manager.clearStatus('read.png');
    expect(manager.isIgnored('new.pdf')).toBe(false);
    await manager.save();
    const stored = saveData.mock.calls[0][0];
    expect(stored.fileStatuses['assets/paper.pdf']).toEqual(legacy.fileStatuses['assets/paper.pdf']);
    expect(stored.fileStatuses['new.pdf']?.statusId).toBe('later');
    expect(stored.readPaths).toContain('read.png');
    expect(stored.knownPaths).toEqual(legacy.knownPaths);
  });

  it('cleans saved non-Markdown records on load while preserving Markdown progress', async () => {
    const saved = savedState();
    const { manager, saveData } = await makeManager(saved);
    expect(manager.getAllFileStatuses()).toEqual({
      'notes/a.md': saved.fileStatuses['notes/a.md'],
      'notes/B.MD': saved.fileStatuses['notes/B.MD'],
    });
    expect(manager.isExplicitlyRead('notes/read.md')).toBe(true);
    expect(manager.isExplicitlyRead('assets/read.png')).toBe(false);
    await manager.save();
    const stored = saveData.mock.calls[0][0];
    expect(stored.knownPaths).toEqual(['notes/a.md', 'notes/B.MD']);
    expect(stored.readPaths).toEqual(['notes/read.md']);
    expect(stored.lastOpenPaths).toEqual(['notes/open.md']);
    expect(stored.lastCloseTime).toBe(saved.lastCloseTime);
    expect(stored.statusConfigs).toEqual(saved.statusConfigs);
  });

  it('cleans immediately when enabled and does not restore removed records when disabled', async () => {
    const { manager } = await makeManager(savedState(false));
    manager.updateSettings({ markdownOnly: true });
    expect(manager.getStatus('assets/paper.pdf')).toBeUndefined();
    expect(manager.getKnownPaths().has('assets/paper.pdf')).toBe(false);
    manager.updateSettings({ markdownOnly: false });
    expect(manager.getStatus('assets/paper.pdf')).toBeUndefined();
    manager.setStatus('new.pdf', 'unread');
    expect(manager.getStatus('new.pdf')?.statusId).toBe('unread');
  });

  it.each(['paper.pdf', 'picture.png', 'script.py', 'state.json', 'debug.log', 'unknown.xyz', 'no-extension', 'note.md.backup'])(
    'rejects %s even if it is not in ignored extensions', async path => {
      const { manager } = await makeManager();
      manager.updateSettings({ markdownOnly: true, ignoreExtensions: [] });
      expect(manager.isIgnored(path)).toBe(true);
      manager.setStatus(path, 'unread');
      manager.clearStatus(path);
      expect(manager.getStatus(path)).toBeUndefined();
      expect(manager.isExplicitlyRead(path)).toBe(false);
    }
  );

  it('allows uppercase Markdown and keeps path and extension exclusions effective', async () => {
    const { manager } = await makeManager();
    manager.updateSettings({ markdownOnly: true, ignorePaths: ['Archive'] });
    expect(manager.isIgnored('notes/A.MD')).toBe(false);
    manager.setStatus('notes/A.MD', 'later');
    expect(manager.getStatus('notes/A.MD')?.statusId).toBe('later');
    manager.clearStatus('notes/A.MD');
    expect(manager.isExplicitlyRead('notes/A.MD')).toBe(true);
    expect(manager.isIgnored('Archive/a.md')).toBe(true);
    manager.updateSettings({ ignoreExtensions: ['md'] });
    expect(manager.isIgnored('notes/a.md')).toBe(true);
  });

  it.each(['save', 'flushSave', 'scheduleSave'] as const)('filters every persistence path: %s', async method => {
    vi.stubGlobal('window', globalThis);
    vi.useFakeTimers();
    const { manager, saveData } = await makeManager(savedState());
    // Simulate an old device's state reaching memory after load: every save must filter it.
    (manager as any).data.fileStatuses['late.pdf'] = { statusId: 'unread', markedAt: 333 };
    (manager as any).data.readPaths.push('late.png');
    manager.setKnownPaths(['notes/a.md', 'late.pdf']);
    manager.setLastOpenPaths(['notes/a.md', 'late.pdf']);
    await manager[method]();
    if (method === 'scheduleSave') await vi.advanceTimersByTimeAsync(300);
    expect(saveData).toHaveBeenCalledTimes(1);
    const stored = saveData.mock.calls[0][0];
    expect(Object.keys(stored.fileStatuses)).toEqual(['notes/a.md', 'notes/B.MD']);
    expect(stored.knownPaths).toEqual(['notes/a.md']);
    expect(stored.lastOpenPaths).toEqual(['notes/a.md']);
    expect(stored.readPaths).toEqual(['notes/read.md']);
    expect(stored.movedPaths).toEqual(['notes/renamed', 'notes/moved.md']);
  });

  it('drops status and snapshots when a Markdown file is renamed to another type', async () => {
    const { manager, saveData } = await makeManager(savedState());
    manager.renamePath('notes/a.md', 'notes/a.txt');
    expect(manager.getStatus('notes/a.txt')).toBeUndefined();
    expect(manager.getKnownPaths().has('notes/a.txt')).toBe(false);
    manager.renamePath('notes/read.md', 'notes/read.txt');
    expect(manager.isExplicitlyRead('notes/read.txt')).toBe(false);
    await manager.save();
    expect(saveData.mock.calls[0][0].fileStatuses['notes/B.MD']?.markedAt).toBe(789);
  });

  it('retains folder move markers across a save and reload for offline detection', async () => {
    const { manager, saveData } = await makeManager(savedState());
    manager.renamePath('notes', 'renamed');
    expect(manager.getStatus('renamed/a.md')).toEqual({ statusId: 'later', markedAt: 123, snoozedUntil: 456 });
    expect(manager.isExplicitlyRead('renamed/read.md')).toBe(true);
    // Use the existing folder fixture as a newly moved folder marker.
    manager.addMovedPath('notes/renamed');
    await manager.flushSave();
    const { manager: reloaded } = await makeManager(saveData.mock.calls[0][0]);
    expect(reloaded.popMovedPaths()).toContain('notes/renamed');
  });
});

describe('Markdown-only entry points', () => {
  it('hides the single-file menu for an excluded attachment', async () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const plugin = new (UnreadPlusPlugin as any)({}, {});
    plugin.app = { workspace: { on: (event: string, handler: (...args: any[]) => void) => { handlers[event] = handler; } } };
    plugin.registerEvent = () => {};
    plugin.stateManager = (await makeManager()).manager;
    plugin.stateManager.updateSettings({ markdownOnly: true });
    plugin.registerContextMenu();
    const file = new TFile();
    file.path = 'assets/paper.pdf';
    const menu = { addItem: vi.fn(), addSeparator: vi.fn() };
    handlers['file-menu'](menu, file);
    expect(menu.addItem).not.toHaveBeenCalled();
    expect(menu.addSeparator).not.toHaveBeenCalled();
  });

  it('filters folder and multi-selection actions without excluding Markdown descendants', async () => {
    const plugin = new (UnreadPlusPlugin as any)({}, {});
    plugin.stateManager = (await makeManager()).manager;
    plugin.stateManager.updateSettings({ markdownOnly: true });
    const note = Object.assign(new TFile(), { path: 'folder/note.md' });
    const pdf = Object.assign(new TFile(), { path: 'folder/paper.pdf' });
    const folder = Object.assign(new TFolder(), { path: 'folder', children: [note, pdf] });
    expect(plugin.expandToFiles([pdf, folder, note])).toEqual([note]);
  });
});
