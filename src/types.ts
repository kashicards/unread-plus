export interface FileStatus {
  statusId: string;
  markedAt: number;       // Date.now() when status was set
  snoozedUntil?: number;  // Date.now() epoch when snooze expires; absent = not snoozed
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
  dotAging: boolean;             // fade dot opacity over time
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
  readPaths: string[];   // paths explicitly marked as read by the user
  lastOpenPaths: string[]; // paths open in a leaf at last clean shutdown — exempt from offline-modification detection
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
  dotAging: true,
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
  readPaths: [],
  lastOpenPaths: [],
};
