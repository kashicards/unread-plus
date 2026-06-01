import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/state-manager';
import { DEFAULT_DATA } from '../src/types';

function makeManager(): StateManager {
  const mockPlugin = {
    loadData: async () => null,
    saveData: async () => {},
  } as any;
  return new StateManager(mockPlugin);
}

describe('StateManager', () => {
  let sm: StateManager;

  beforeEach(async () => {
    sm = makeManager();
    await sm.load();
  });

  it('starts with no file statuses', () => {
    expect(sm.getAllFileStatuses()).toEqual({});
  });

  it('sets and gets a status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    expect(sm.getStatus('notes/foo.md')?.statusId).toBe('unread');
  });

  it('clears a status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    sm.clearStatus('notes/foo.md');
    expect(sm.getStatus('notes/foo.md')).toBeUndefined();
  });

  it('hasOpenStatus returns true for countsAsOpen status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(true);
  });

  it('hasOpenStatus returns false for skip status', () => {
    sm.setStatus('notes/foo.md', 'skip');
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(false);
  });

  it('hasOpenStatus returns false for unknown path', () => {
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(false);
  });

  it('isIgnored matches path prefix', () => {
    sm.updateSettings({ ignorePaths: ['Archive'] });
    expect(sm.isIgnored('Archive/old.md')).toBe(true);
    expect(sm.isIgnored('Notes/old.md')).toBe(false);
  });

  it('isIgnored matches exact path', () => {
    sm.updateSettings({ ignorePaths: ['special.md'] });
    expect(sm.isIgnored('special.md')).toBe(true);
  });

  it('isIgnored matches extension', () => {
    sm.updateSettings({ ignoreExtensions: ['pdf'] });
    expect(sm.isIgnored('file.pdf')).toBe(true);
    expect(sm.isIgnored('file.md')).toBe(false);
  });

  it('renames status key when path changes', () => {
    sm.setStatus('old/file.md', 'review');
    sm.renamePath('old/file.md', 'new/file.md');
    expect(sm.getStatus('new/file.md')?.statusId).toBe('review');
    expect(sm.getStatus('old/file.md')).toBeUndefined();
  });

  it('renames all files in folder when folder path changes', () => {
    sm.setStatus('old/a.md', 'unread');
    sm.setStatus('old/sub/b.md', 'review');
    sm.renamePath('old', 'new');
    expect(sm.getStatus('new/a.md')?.statusId).toBe('unread');
    expect(sm.getStatus('new/sub/b.md')?.statusId).toBe('review');
    expect(sm.getStatus('old/a.md')).toBeUndefined();
  });

  it('deletes all statuses under a deleted path prefix', () => {
    sm.setStatus('old/a.md', 'unread');
    sm.setStatus('other/b.md', 'unread');
    sm.deletePath('old');
    expect(sm.getStatus('old/a.md')).toBeUndefined();
    expect(sm.getStatus('other/b.md')).toBeDefined();
  });
});
