import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/state-manager';
import UnreadPlusPlugin from '../main.ts';

(globalThis as any).window = globalThis;

function makePlugin(): UnreadPlusPlugin {
  const app = { workspace: { iterateAllLeaves: () => {} } };
  const plugin = new (UnreadPlusPlugin as any)(app, {});
  plugin.app = app;
  plugin.stateManager = new StateManager(plugin);
  plugin.badgeRenderer = { refresh: () => {} };
  (plugin as any).statusBarItem = { empty: () => {}, addClass: () => {}, removeClass: () => {}, createSpan: () => ({ setCssStyles: () => {} }) };
  return plugin;
}

describe('overview refresh registry', () => {
  let plugin: UnreadPlusPlugin;

  beforeEach(async () => {
    plugin = makePlugin();
    await plugin.stateManager.load();
  });

  it('calls a registered callback when the plugin refreshes the UI', () => {
    let calls = 0;
    const cb = () => { calls++; };

    plugin.registerOverviewRefresh(cb);
    plugin.setFileStatus('a.md', 'unread');

    expect(calls).toBe(1);
  });

  it('stops calling a callback after it is unregistered', () => {
    let calls = 0;
    const cb = () => { calls++; };

    plugin.registerOverviewRefresh(cb);
    plugin.setFileStatus('a.md', 'unread');
    plugin.unregisterOverviewRefresh(cb);
    plugin.clearFileStatus('a.md');

    expect(calls).toBe(1);
  });
});
