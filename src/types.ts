export interface FileStatus {
  statusId: string;
  markedAt: number; // Date.now() timestamp
}

export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  countsAsOpen: boolean;
}

export interface UnreadPlusSettings {
  autoReadSeconds: number;       // 0 = disabled
  ignorePaths: string[];         // prefix-match, e.g. "Archive"
  ignoreExtensions: string[];    // without dot, e.g. ["pdf", "png"]
  badgeShowLabel: boolean;       // show "● unread" vs just "●"
  reviewEnabled: boolean;
  reviewOrder: 'created' | 'folder' | 'random';
  reviewStatusFilter: string[];  // statusIds to include in review queue
  reviewAutoMarkSeconds: number; // 0 = disabled
}

export interface PluginData {
  version: number;
  fileStatuses: Record<string, FileStatus>;
  statusConfigs: StatusConfig[];
  settings: UnreadPlusSettings;
}

export interface FolderCount {
  total: number;
  dominantColor: string;
}

export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#FA6300', countsAsOpen: true },
  { id: 'skip',   label: 'Skip',   color: '#888888', countsAsOpen: false },
  { id: 'review', label: 'Review', color: '#2066DF', countsAsOpen: true },
];

export const DEFAULT_SETTINGS: UnreadPlusSettings = {
  autoReadSeconds: 0,
  ignorePaths: [],
  ignoreExtensions: [],
  badgeShowLabel: false,
  reviewEnabled: true,
  reviewOrder: 'created',
  reviewStatusFilter: ['unread', 'review'],
  reviewAutoMarkSeconds: 0,
};

export const DEFAULT_DATA: PluginData = {
  version: 1,
  fileStatuses: {},
  statusConfigs: DEFAULT_STATUS_CONFIGS,
  settings: DEFAULT_SETTINGS,
};
