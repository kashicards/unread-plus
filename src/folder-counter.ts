import { FileStatus, StatusConfig, FolderCount } from './types';

export function computeFolderCounts(
  fileStatuses: Record<string, FileStatus>,
  statusConfigs: StatusConfig[],
): Map<string, FolderCount> {
  const openConfigs = new Map(
    statusConfigs.filter(s => s.countsAsOpen).map(s => [s.id, s])
  );

  // folderPath → statusId → count
  const folderStatusCounts = new Map<string, Map<string, number>>();

  for (const [path, status] of Object.entries(fileStatuses)) {
    if (!openConfigs.has(status.statusId)) continue;

    const parts = path.split('/');
    // iterate ancestor folders (not the file itself)
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join('/');
      if (!folderStatusCounts.has(folderPath)) {
        folderStatusCounts.set(folderPath, new Map());
      }
      const counts = folderStatusCounts.get(folderPath)!;
      counts.set(status.statusId, (counts.get(status.statusId) ?? 0) + 1);
    }
  }

  const result = new Map<string, FolderCount>();
  for (const [folderPath, statusCounts] of folderStatusCounts) {
    const total = [...statusCounts.values()].reduce((a, b) => a + b, 0);
    const [dominantId] = [...statusCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominantColor = openConfigs.get(dominantId)?.color ?? '#FA6300';
    result.set(folderPath, { total, dominantColor });
  }

  return result;
}
