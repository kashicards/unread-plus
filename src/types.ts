export interface FileStatus {
  statusId: string;
  markedAt: number;
  snoozedUntil?: number;
}

export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  countsAsOpen: boolean;
}

export interface UnreadPlusSettings {
  autoReadSeconds: number;
  ignorePaths: string[];
  ignoreExtensions: string[];
  badgeShowLabel: boolean;
  dotAging: boolean;
  reviewOrder: 'created' | 'folder' | 'random';
  reviewAutoMarkSeconds: number;
}

export interface PluginData {
  version: number;
  fileStatuses: Record<string, FileStatus>;
  statusConfigs: StatusConfig[];
  settings: UnreadPlusSettings;
  knownPaths: string[];      // vault snapshot at last shutdown
  lastCloseTime: number;     // Date.now() at last clean shutdown
  readPaths: string[];       // explicitly marked read by the user
  lastOpenPaths: string[];   // open in a leaf at last shutdown — exempt from offline-modification check
  movedPaths: string[];      // renamed/moved paths this session — consumed at next startup
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
  movedPaths: [],
};
