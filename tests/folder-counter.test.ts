import { describe, it, expect } from 'vitest';
import { computeFolderCounts } from '../src/folder-counter';
import { StatusConfig, FileStatus } from '../src/types';

const CONFIGS: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#4285F4', countsAsOpen: true },
  { id: 'skip',   label: 'Skip',   color: '#888888', countsAsOpen: false },
  { id: 'later',  label: 'Later',  color: '#FF8C00', countsAsOpen: true },
];

function makeStatuses(entries: [string, string][]): Record<string, FileStatus> {
  return Object.fromEntries(
    entries.map(([path, statusId]) => [path, { statusId, markedAt: 0 }])
  );
}

function totalFor(path: string, counts: ReturnType<typeof computeFolderCounts>): number {
  return counts.get(path)?.segments.reduce((s, seg) => s + seg.count, 0) ?? 0;
}

describe('computeFolderCounts', () => {
  it('returns empty map when no open statuses', () => {
    const statuses = makeStatuses([['Archive/file.md', 'skip']]);
    expect(computeFolderCounts(statuses, CONFIGS).size).toBe(0);
  });

  it('counts a single file in its parent folder', () => {
    const statuses = makeStatuses([['Notes/foo.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(totalFor('Notes', counts)).toBe(1);
  });

  it('propagates up multiple folder levels', () => {
    const statuses = makeStatuses([['a/b/c/file.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(totalFor('a', counts)).toBe(1);
    expect(totalFor('a/b', counts)).toBe(1);
    expect(totalFor('a/b/c', counts)).toBe(1);
  });

  it('sums multiple files across folders', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'unread'],
      ['Notes/b.md', 'later'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(totalFor('Notes', counts)).toBe(2);
  });

  it('returns one segment per status in config order', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'later'],
      ['Notes/b.md', 'later'],
      ['Notes/c.md', 'unread'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    const segs = counts.get('Notes')?.segments ?? [];
    // unread comes first (config order), then later
    expect(segs[0]).toMatchObject({ count: 1, color: '#4285F4' });
    expect(segs[1]).toMatchObject({ count: 2, color: '#FF8C00' });
  });

  it('does not count root-level files (no parent folder)', () => {
    const statuses = makeStatuses([['root-file.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.size).toBe(0);
  });

  it('skips non-open statuses in counts', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'skip'],
      ['Notes/b.md', 'unread'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(totalFor('Notes', counts)).toBe(1);
  });
});
