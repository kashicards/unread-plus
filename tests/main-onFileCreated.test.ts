import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TFile, FileView } from 'obsidian';
import { StateManager } from '../src/state-manager';
import UnreadPlusPlugin from '../main.ts';

(globalThis as any).window = globalThis;

function makeFileView(file: TFile): FileView {
  const view = Object.create(FileView.prototype) as FileView;
  (view as { file: TFile }).file = file;
  return view;
}

function makeApp(leaves: Array<{ view: unknown }>) {
  return {
    workspace: {
      iterateAllLeaves: (cb: (leaf: { view: unknown }) => void) => leaves.forEach(cb),
    },
  };
}

function makePlugin(app: unknown): UnreadPlusPlugin {
  const plugin = new (UnreadPlusPlugin as any)(app, {});
  plugin.app = app;
  plugin.stateManager = new StateManager(plugin);
  plugin.badgeRenderer = { refresh: () => {} };
  (plugin as any).statusBarItem = { empty: () => {}, addClass: () => {}, removeClass: () => {}, createSpan: () => ({ setCssStyles: () => {} }) };
  return plugin;
}

describe('onFileCreated vs. session-open race (Templater-style delayed insert)', () => {
  let leaves: Array<{ view: unknown }>;
  let plugin: UnreadPlusPlugin;
  let file: TFile;

  beforeEach(async () => {
    vi.useFakeTimers();
    file = new TFile();
    file.path = 'notes/new.md';
    leaves = [];
    plugin = makePlugin(makeApp(leaves));
    await plugin.stateManager.load();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not stay marked unread when the file was opened, then its leaf briefly stops reporting as a FileView', () => {
    // 'create' fires before Obsidian has attached a leaf for the new note.
    (plugin as any).onFileCreated(file);

    // The standard "New note" flow opens the note into a leaf right away.
    leaves.push({ view: makeFileView(file) });
    (plugin as any).onFileOpen(file);

    // A template-insertion plugin (e.g. Templater) briefly takes over the
    // leaf (a suggester/modal) so it no longer reports as an open FileView
    // for this file at the moment our 150ms recheck runs.
    leaves.length = 0;

    vi.advanceTimersByTime(150);

    expect(plugin.stateManager.getStatus(file.path)).toBeUndefined();
  });
});
