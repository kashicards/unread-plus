import { describe, it, expect } from 'vitest';
import { sortEntries } from '../src/sort-entries';
import { FileStatus } from '../src/types';

function entry(path: string, markedAt: number): [string, FileStatus] {
  return [path, { statusId: 'unread', markedAt }];
}

describe('sortEntries', () => {
  it('sorts by created (oldest markedAt first)', () => {
    const entries = [entry('b.md', 200), entry('a.md', 100), entry('c.md', 300)];
    const sorted = sortEntries(entries, 'created');
    expect(sorted.map(([p]) => p)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('sorts by folder (path, locale order)', () => {
    const entries = [entry('z/note.md', 1), entry('a/note.md', 1), entry('m/note.md', 1)];
    const sorted = sortEntries(entries, 'folder');
    expect(sorted.map(([p]) => p)).toEqual(['a/note.md', 'm/note.md', 'z/note.md']);
  });

  it('random returns all the same elements without mutating the input', () => {
    const entries = [entry('a.md', 1), entry('b.md', 2), entry('c.md', 3)];
    const original = [...entries];
    const sorted = sortEntries(entries, 'random');
    expect(sorted).toHaveLength(3);
    expect(new Set(sorted.map(([p]) => p))).toEqual(new Set(['a.md', 'b.md', 'c.md']));
    expect(entries).toEqual(original);
  });
});
