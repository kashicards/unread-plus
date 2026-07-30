import { FileStatus } from './types';

export type SortOrder = 'created' | 'folder' | 'random';

export function sortEntries(
  entries: Array<[string, FileStatus]>,
  order: SortOrder,
): Array<[string, FileStatus]> {
  const copy = [...entries];

  if (order === 'created') {
    copy.sort((a, b) => a[1].markedAt - b[1].markedAt);
  } else if (order === 'folder') {
    copy.sort((a, b) => a[0].localeCompare(b[0]));
  } else {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }

  return copy;
}
