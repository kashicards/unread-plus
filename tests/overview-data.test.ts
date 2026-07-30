import { describe, it, expect } from 'vitest';
import { selectOverviewEntries, computeOverviewStats } from '../src/overview-data';
import { parseOverviewParams } from '../src/overview-params';
import { FileStatus, StatusConfig } from '../src/types';

const configs: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#4285F4', countsAsOpen: true },
  { id: 'later', label: 'Later', color: '#FF8C00', countsAsOpen: true },
];

const fileStatuses: Record<string, FileStatus> = {
  'Notes/a.md': { statusId: 'unread', markedAt: 100 },
  'Notes/b.md': { statusId: 'later', markedAt: 200 },
  'News/c.md': { statusId: 'unread', markedAt: 50 },
  'News/snoozed.md': { statusId: 'unread', markedAt: 10, snoozedUntil: Date.now() + 999_999 },
};

const neverSnoozed = () => false;

describe('selectOverviewEntries', () => {
  it('includes all countsAsOpen statuses and excludes snoozed files by default', () => {
    const params = parseOverviewParams('', ['unread', 'later']);
    const allowed = new Set(['unread', 'later']);
    const isSnoozed = (path: string) => path === 'News/snoozed.md';

    const entries = selectOverviewEntries(fileStatuses, isSnoozed, params, allowed);

    expect(entries.map(([p]) => p).sort()).toEqual(['News/c.md', 'Notes/a.md', 'Notes/b.md']);
  });

  it('filters by folder prefix', () => {
    const params = parseOverviewParams('folder: News', ['unread', 'later']);
    const allowed = new Set(['unread', 'later']);

    const entries = selectOverviewEntries(fileStatuses, neverSnoozed, params, allowed);

    expect(entries.map(([p]) => p)).toEqual(['News/snoozed.md', 'News/c.md']);
  });

  it('filters by allowed status IDs', () => {
    const params = parseOverviewParams('status: later', ['unread', 'later']);
    const allowed = new Set(['later']);

    const entries = selectOverviewEntries(fileStatuses, neverSnoozed, params, allowed);

    expect(entries.map(([p]) => p)).toEqual(['Notes/b.md']);
  });

  it('sorts using the resolved sort order', () => {
    const params = parseOverviewParams('sort: age', ['unread', 'later']);
    const allowed = new Set(['unread', 'later']);

    const entries = selectOverviewEntries(fileStatuses, (p) => p === 'News/snoozed.md', params, allowed);

    expect(entries.map(([p]) => p)).toEqual(['News/c.md', 'Notes/a.md', 'Notes/b.md']);
  });
});

describe('computeOverviewStats', () => {
  it('counts entries per status in statusConfigs order', () => {
    const entries: Array<[string, FileStatus]> = [
      ['a.md', { statusId: 'unread', markedAt: 1 }],
      ['b.md', { statusId: 'unread', markedAt: 2 }],
      ['c.md', { statusId: 'later', markedAt: 3 }],
    ];

    const stats = computeOverviewStats(entries, configs);

    expect(stats).toEqual([
      { config: configs[0], count: 2 },
      { config: configs[1], count: 1 },
    ]);
  });

  it('omits statuses with zero matching entries', () => {
    const entries: Array<[string, FileStatus]> = [['a.md', { statusId: 'later', markedAt: 1 }]];

    const stats = computeOverviewStats(entries, configs);

    expect(stats).toEqual([{ config: configs[1], count: 1 }]);
  });
});
