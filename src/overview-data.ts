import { FileStatus, StatusConfig } from './types';
import { OverviewParams } from './overview-params';
import { sortEntries } from './sort-entries';

export function selectOverviewEntries(
  fileStatuses: Record<string, FileStatus>,
  isSnoozed: (path: string) => boolean,
  params: OverviewParams,
  allowedStatusIds: Set<string>,
): Array<[string, FileStatus]> {
  const entries = Object.entries(fileStatuses).filter(([path, status]) => {
    if (isSnoozed(path)) return false;
    if (!allowedStatusIds.has(status.statusId)) return false;
    if (params.folder && !(path === params.folder || path.startsWith(params.folder + '/'))) return false;
    return true;
  });

  return sortEntries(entries, params.sort);
}

export interface OverviewStat {
  config: StatusConfig;
  count: number;
}

export function computeOverviewStats(
  entries: Array<[string, FileStatus]>,
  statusConfigs: StatusConfig[],
): OverviewStat[] {
  const counts = new Map<string, number>();
  for (const [, status] of entries) {
    counts.set(status.statusId, (counts.get(status.statusId) ?? 0) + 1);
  }

  return statusConfigs
    .filter(c => counts.has(c.id))
    .map(c => ({ config: c, count: counts.get(c.id)! }));
}
