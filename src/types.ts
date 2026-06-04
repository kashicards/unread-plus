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
  reviewOrder: 'created' | 'folder' | 'random';
  reviewAutoMarkSeconds: number; // 0 = disabled
}

export interface PluginData {
  version: number;
  fileStatuses: Record<string, FileStatus>;
  statusConfigs: StatusConfig[];
  settings: UnreadPlusSettings;
  knownPaths: string[];
  lastCloseTime: number; // Date.now() when Obsidian last closed cleanly
}

export interface FolderCount {
  segments: Array<{ count: number; color: string }>;
}

export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#4285F4', countsAsOpen: true },
  { id: 'later',  label: 'Later',  color: '#FF8C00', countsAsOpen: true },
];

export const DEFAULT_SETTINGS: UnreadPlusSettings = {
  autoReadSeconds: 0,
  ignorePaths: [],
  ignoreExtensions: ['json'],
  badgeShowLabel: false,
  reviewOrder: 'created',
  reviewAutoMarkSeconds: 0,
};

export const DEFAULT_DATA: PluginData = {
  version: 4,
  fileStatuses: {},
  statusConfigs: DEFAULT_STATUS_CONFIGS,
  settings: DEFAULT_SETTINGS,
  knownPaths: [],
  lastCloseTime: 0,
};
