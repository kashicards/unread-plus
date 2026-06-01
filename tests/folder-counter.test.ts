import { describe, it, expect } from 'vitest';
import { computeFolderCounts } from '../src/folder-counter';
import { StatusConfig, FileStatus } from '../src/types';

const CONFIGS: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#FA6300', countsAsOpen: true },
  { id: 'skip',   label: 'Skip',   color: '#888888', countsAsOpen: false },
  { id: 'review', label: 'Review', color: '#2066DF', countsAsOpen: true },
];

function makeStatuses(entries: [string, string][]): Record<string, FileStatus> {
  return Object.fromEntries(
    entries.map(([path, statusId]) => [path, { statusId, markedAt: 0 }])
  );
}

describe('computeFolderCounts', () => {
  it('returns empty map when no open statuses', () => {
    const statuses = makeStatuses([['Archive/file.md', 'skip']]);
    expect(computeFolderCounts(statuses, CONFIGS).size).toBe(0);
  });

  it('counts a single file in its parent folder', () => {
    const statuses = makeStatuses([['Notes/foo.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.total).toBe(1);
  });

  it('propagates up multiple folder levels', () => {
    const statuses = makeStatuses([['a/b/c/file.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('a')?.total).toBe(1);
    expect(counts.get('a/b')?.total).toBe(1);
    expect(counts.get('a/b/c')?.total).toBe(1);
  });

  it('sums multiple files across folders', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'unread'],
      ['Notes/b.md', 'review'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.total).toBe(2);
  });

  it('picks dominant color from most frequent status', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'review'],
      ['Notes/b.md', 'review'],
      ['Notes/c.md', 'unread'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.dominantColor).toBe('#2066DF'); // review color
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
    expect(counts.get('Notes')?.total).toBe(1);
  });
});
