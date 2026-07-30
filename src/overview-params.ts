import { SortOrder } from './sort-entries';

export interface OverviewParams {
  statusIds: string[] | null;
  folder: string | null;
  limit: number;
  sort: SortOrder;
  showStats: boolean;
  showList: boolean;
}

export function parseOverviewParams(source: string, knownStatusIds: string[]): OverviewParams {
  const raw: Record<string, string> = {};
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    raw[key] = value;
  }

  const statusIds = raw.status
    ? raw.status.split(',').map(s => s.trim()).filter(s => knownStatusIds.includes(s))
    : null;

  const folder = raw.folder ? raw.folder : null;

  const parsedLimit = raw.limit ? parseInt(raw.limit, 10) : NaN;
  const limit = !isNaN(parsedLimit) ? parsedLimit : 20;

  const sort: SortOrder =
    raw.sort === 'folder' ? 'folder' : raw.sort === 'random' ? 'random' : 'created';

  const showValues = raw.show ? raw.show.split(',').map(s => s.trim()) : ['stats', 'list'];
  const showStats = showValues.includes('stats');
  const showList = showValues.includes('list');

  return { statusIds, folder, limit, sort, showStats, showList };
}
