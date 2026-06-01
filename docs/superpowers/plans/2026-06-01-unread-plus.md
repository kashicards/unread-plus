# Unread+ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that marks newly created files with a status dot and propagates unread counts up the folder tree, with a configurable status system and review mode.

**Architecture:** A `StateManager` owns all persistence (file→status map, settings, status configs). A `BadgeRenderer` reads from `StateManager` and injects DOM badges into the file explorer using stable `[data-path]` CSS selectors + `MutationObserver`. Pure logic modules (`FolderCounter`) are unit-tested with Vitest; DOM and Obsidian integration is verified via manual test checklist.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild (bundler), Vitest (unit tests)

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types.ts` | All shared interfaces and constants |
| `src/state-manager.ts` | CRUD for file statuses, settings, persistence |
| `src/folder-counter.ts` | Pure function: compute per-folder counts from state |
| `src/badge-renderer.ts` | DOM injection into file explorer, MutationObserver |
| `src/review-mode.ts` | Review queue build, navigation |
| `src/settings-tab.ts` | Obsidian SettingTab UI |
| `main.ts` | Plugin entry point, wires all modules, registers events |
| `styles.css` | All visual styles |
| `manifest.json` | Plugin metadata |
| `package.json` | Build scripts and dependencies |
| `tsconfig.json` | TypeScript config |
| `esbuild.config.mjs` | Bundle config |
| `vitest.config.ts` | Test config |
| `tests/__mocks__/obsidian.ts` | Minimal obsidian stub for unit tests |
| `tests/state-manager.test.ts` | Unit tests for StateManager |
| `tests/folder-counter.test.ts` | Unit tests for FolderCounter |

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `vitest.config.ts`
- Create: `tests/__mocks__/obsidian.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "unread-plus",
  "version": "1.0.0",
  "description": "Marks new files unread, propagates counts up folder tree",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.21.0",
    "obsidian": "latest",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2018",
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "lib": ["DOM", "ES2018"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `esbuild.config.mjs`**

```js
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      obsidian: resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
});
```

- [ ] **Step 6: Create `tests/__mocks__/obsidian.ts`**

```typescript
export class Plugin {
  app: any;
  loadData = async (): Promise<any> => null;
  saveData = async (_data: any): Promise<void> => {};
}

export class TFile { path = ''; basename = ''; extension = ''; }
export class TFolder { path = ''; }
export class TAbstractFile { path = ''; }
export class Notice { constructor(_msg: string) {} }
export class PluginSettingTab {
  constructor(public app: any, public plugin: any) {}
  display(): void {}
  hide(): void {}
}
export class Setting {
  constructor(_containerEl: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(_cb: any) { return this; }
  addTextArea(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
  addColorPicker(_cb: any) { return this; }
}
export class Menu {
  addItem(_cb: any) { return this; }
  addSeparator() { return this; }
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
main.js
*.js.map
```

- [ ] **Step 8: Verify build runs**

Run: `npm run build`
Expected: `main.js` created (will be mostly empty until main.ts exists — acceptable, or create a minimal `main.ts` first: `export default class P {}`)

- [ ] **Step 9: Commit**

```bash
git init
git add package.json tsconfig.json esbuild.config.mjs vitest.config.ts tests/__mocks__/obsidian.ts .gitignore
git commit -m "chore: scaffold project with build and test setup"
```

---

## Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: StateManager

**Files:**
- Create: `src/state-manager.ts`
- Create: `tests/state-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/state-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/state-manager';
import { DEFAULT_DATA } from '../src/types';

function makeManager(): StateManager {
  const mockPlugin = {
    loadData: async () => null,
    saveData: async () => {},
  } as any;
  return new StateManager(mockPlugin);
}

describe('StateManager', () => {
  let sm: StateManager;

  beforeEach(async () => {
    sm = makeManager();
    await sm.load();
  });

  it('starts with no file statuses', () => {
    expect(sm.getAllFileStatuses()).toEqual({});
  });

  it('sets and gets a status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    expect(sm.getStatus('notes/foo.md')?.statusId).toBe('unread');
  });

  it('clears a status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    sm.clearStatus('notes/foo.md');
    expect(sm.getStatus('notes/foo.md')).toBeUndefined();
  });

  it('hasOpenStatus returns true for countsAsOpen status', () => {
    sm.setStatus('notes/foo.md', 'unread');
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(true);
  });

  it('hasOpenStatus returns false for skip status', () => {
    sm.setStatus('notes/foo.md', 'skip');
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(false);
  });

  it('hasOpenStatus returns false for unknown path', () => {
    expect(sm.hasOpenStatus('notes/foo.md')).toBe(false);
  });

  it('isIgnored matches path prefix', () => {
    sm.updateSettings({ ignorePaths: ['Archive'] });
    expect(sm.isIgnored('Archive/old.md')).toBe(true);
    expect(sm.isIgnored('Notes/old.md')).toBe(false);
  });

  it('isIgnored matches exact path', () => {
    sm.updateSettings({ ignorePaths: ['special.md'] });
    expect(sm.isIgnored('special.md')).toBe(true);
  });

  it('isIgnored matches extension', () => {
    sm.updateSettings({ ignoreExtensions: ['pdf'] });
    expect(sm.isIgnored('file.pdf')).toBe(true);
    expect(sm.isIgnored('file.md')).toBe(false);
  });

  it('renames status key when path changes', () => {
    sm.setStatus('old/file.md', 'review');
    sm.renamePath('old/file.md', 'new/file.md');
    expect(sm.getStatus('new/file.md')?.statusId).toBe('review');
    expect(sm.getStatus('old/file.md')).toBeUndefined();
  });

  it('renames all files in folder when folder path changes', () => {
    sm.setStatus('old/a.md', 'unread');
    sm.setStatus('old/sub/b.md', 'review');
    sm.renamePath('old', 'new');
    expect(sm.getStatus('new/a.md')?.statusId).toBe('unread');
    expect(sm.getStatus('new/sub/b.md')?.statusId).toBe('review');
    expect(sm.getStatus('old/a.md')).toBeUndefined();
  });

  it('deletes all statuses under a deleted path prefix', () => {
    sm.setStatus('old/a.md', 'unread');
    sm.setStatus('other/b.md', 'unread');
    sm.deletePath('old');
    expect(sm.getStatus('old/a.md')).toBeUndefined();
    expect(sm.getStatus('other/b.md')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: all tests fail with "Cannot find module '../src/state-manager'"

- [ ] **Step 3: Implement `src/state-manager.ts`**

```typescript
import { Plugin } from 'obsidian';
import {
  PluginData, FileStatus, StatusConfig, UnreadPlusSettings, DEFAULT_DATA,
} from './types';

export class StateManager {
  private data: PluginData = structuredClone(DEFAULT_DATA);

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    const saved = await this.plugin.loadData();
    if (!saved) return;
    this.data = {
      ...DEFAULT_DATA,
      ...saved,
      settings: { ...DEFAULT_DATA.settings, ...saved.settings },
      statusConfigs: saved.statusConfigs ?? DEFAULT_DATA.statusConfigs,
      fileStatuses: saved.fileStatuses ?? {},
    };
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  // --- File status ---

  setStatus(path: string, statusId: string): void {
    this.data.fileStatuses[path] = { statusId, markedAt: Date.now() };
  }

  clearStatus(path: string): void {
    delete this.data.fileStatuses[path];
  }

  getStatus(path: string): FileStatus | undefined {
    return this.data.fileStatuses[path];
  }

  getAllFileStatuses(): Record<string, FileStatus> {
    return { ...this.data.fileStatuses };
  }

  hasOpenStatus(path: string): boolean {
    const status = this.getStatus(path);
    if (!status) return false;
    return this.getStatusConfig(status.statusId)?.countsAsOpen ?? false;
  }

  renamePath(oldPath: string, newPath: string): void {
    const entries = Object.entries(this.data.fileStatuses);
    for (const [path, status] of entries) {
      if (path === oldPath || path.startsWith(oldPath + '/')) {
        const updated = newPath + path.slice(oldPath.length);
        delete this.data.fileStatuses[path];
        this.data.fileStatuses[updated] = status;
      }
    }
  }

  deletePath(path: string): void {
    for (const key of Object.keys(this.data.fileStatuses)) {
      if (key === path || key.startsWith(path + '/')) {
        delete this.data.fileStatuses[key];
      }
    }
  }

  clearAll(): void {
    this.data.fileStatuses = {};
  }

  // --- Status configs ---

  getStatusConfigs(): StatusConfig[] {
    return this.data.statusConfigs;
  }

  getStatusConfig(id: string): StatusConfig | undefined {
    return this.data.statusConfigs.find(s => s.id === id);
  }

  updateStatusConfigs(configs: StatusConfig[]): void {
    this.data.statusConfigs = configs;
  }

  // --- Settings ---

  getSettings(): UnreadPlusSettings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<UnreadPlusSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
  }

  // --- Ignore ---

  isIgnored(path: string): boolean {
    const { ignorePaths, ignoreExtensions } = this.data.settings;
    if (ignorePaths.some(p => path === p || path.startsWith(p + '/'))) return true;
    const ext = path.includes('.') ? path.split('.').pop()! : '';
    return ignoreExtensions.includes(ext);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state-manager.ts tests/state-manager.test.ts
git commit -m "feat: add StateManager with persistence and ignore logic"
```

---

## Task 4: FolderCounter

**Files:**
- Create: `src/folder-counter.ts`
- Create: `tests/folder-counter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/folder-counter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeFolderCounts } from '../src/folder-counter';
import { StatusConfig, FileStatus } from '../src/types';

const CONFIGS: StatusConfig[] = [
  { id: 'unread', label: 'Unread', color: '#FA6300', countsAsOpen: true },
  { id: 'skip',   label: 'Skip',   color: '#888888', countsAsOpen: false },
  { id: 'review', label: 'Review', color: '#2066DF', countsAsOpen: true },
];

function makeStatuses(entries: [string, string][]): Record<string, FileStatus> {
  return Object.fromEntries(
    entries.map(([path, statusId]) => [path, { statusId, markedAt: 0 }])
  );
}

describe('computeFolderCounts', () => {
  it('returns empty map when no open statuses', () => {
    const statuses = makeStatuses([['Archive/file.md', 'skip']]);
    expect(computeFolderCounts(statuses, CONFIGS).size).toBe(0);
  });

  it('counts a single file in its parent folder', () => {
    const statuses = makeStatuses([['Notes/foo.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.total).toBe(1);
  });

  it('propagates up multiple folder levels', () => {
    const statuses = makeStatuses([['a/b/c/file.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('a')?.total).toBe(1);
    expect(counts.get('a/b')?.total).toBe(1);
    expect(counts.get('a/b/c')?.total).toBe(1);
  });

  it('sums multiple files across folders', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'unread'],
      ['Notes/b.md', 'review'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.total).toBe(2);
  });

  it('picks dominant color from most frequent status', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'review'],
      ['Notes/b.md', 'review'],
      ['Notes/c.md', 'unread'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.dominantColor).toBe('#2066DF'); // review color
  });

  it('does not count root-level files (no parent folder)', () => {
    const statuses = makeStatuses([['root-file.md', 'unread']]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.size).toBe(0);
  });

  it('skips non-open statuses in counts', () => {
    const statuses = makeStatuses([
      ['Notes/a.md', 'skip'],
      ['Notes/b.md', 'unread'],
    ]);
    const counts = computeFolderCounts(statuses, CONFIGS);
    expect(counts.get('Notes')?.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: all folder-counter tests fail with "Cannot find module"

- [ ] **Step 3: Implement `src/folder-counter.ts`**

```typescript
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
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all tests pass (StateManager + FolderCounter).

- [ ] **Step 5: Commit**

```bash
git add src/folder-counter.ts tests/folder-counter.test.ts
git commit -m "feat: add FolderCounter with upward propagation"
```

---

## Task 5: BadgeRenderer

**Files:**
- Create: `src/badge-renderer.ts`

- [ ] **Step 1: Create `src/badge-renderer.ts`**

```typescript
import { App } from 'obsidian';
import { StateManager } from './state-manager';
import { computeFolderCounts } from './folder-counter';

export class BadgeRenderer {
  private observer: MutationObserver | null = null;
  private isRendering = false;

  constructor(private app: App, private stateManager: StateManager) {}

  start(): void {
    this.app.workspace.onLayoutReady(() => {
      this.refresh();
      this.attachObserver();
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.clearAll();
  }

  refresh(): void {
    const container = this.getExplorerContainer();
    if (!container) return;

    this.isRendering = true;
    this.clearAll(container);
    this.renderFileDots(container);
    this.renderFolderBadges(container);
    this.isRendering = false;
  }

  private getExplorerContainer(): HTMLElement | null {
    const leaves = this.app.workspace.getLeavesOfType('file-explorer');
    return leaves.length > 0 ? (leaves[0].view as any).containerEl as HTMLElement : null;
  }

  private clearAll(container?: HTMLElement): void {
    const root = container ?? this.getExplorerContainer();
    if (!root) return;
    root.querySelectorAll('.unread-plus-dot, .unread-plus-folder-badge').forEach(el => el.remove());
  }

  private renderFileDots(container: HTMLElement): void {
    const configs = this.stateManager.getStatusConfigs();
    const configMap = new Map(configs.map(c => [c.id, c]));
    const settings = this.stateManager.getSettings();

    container.querySelectorAll<HTMLElement>('.nav-file-title[data-path]').forEach(titleEl => {
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const status = this.stateManager.getStatus(path);
      if (!status) return;

      const config = configMap.get(status.statusId);
      if (!config) return;

      const dot = document.createElement('span');
      dot.className = 'unread-plus-dot';
      dot.setAttribute('data-status', status.statusId);
      dot.style.setProperty('--dot-color', config.color);

      if (settings.badgeShowLabel) {
        dot.textContent = ` ${config.label}`;
      }

      titleEl.appendChild(dot);
    });
  }

  private renderFolderBadges(container: HTMLElement): void {
    const folderCounts = computeFolderCounts(
      this.stateManager.getAllFileStatuses(),
      this.stateManager.getStatusConfigs(),
    );

    container.querySelectorAll<HTMLElement>('.nav-folder-title[data-path]').forEach(titleEl => {
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const count = folderCounts.get(path);
      if (!count || count.total === 0) return;

      const badge = document.createElement('span');
      badge.className = 'unread-plus-folder-badge';
      badge.style.setProperty('--badge-color', count.dominantColor);
      badge.textContent = `(${count.total})`;
      titleEl.appendChild(badge);
    });
  }

  private attachObserver(): void {
    const container = this.getExplorerContainer();
    if (!container) return;

    this.observer = new MutationObserver(mutations => {
      if (this.isRendering) return;
      // only re-render when nav-file or nav-folder nodes are added/removed
      const relevant = mutations.some(m =>
        [...m.addedNodes, ...m.removedNodes].some(n =>
          n instanceof HTMLElement &&
          (n.classList.contains('nav-file') ||
           n.classList.contains('nav-folder') ||
           n.classList.contains('nav-folder-children'))
        )
      );
      if (relevant) this.refresh();
    });

    this.observer.observe(container, { childList: true, subtree: true });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/badge-renderer.ts
git commit -m "feat: add BadgeRenderer with MutationObserver and data-path injection"
```

---

## Task 6: Main plugin skeleton + events

**Files:**
- Create: `main.ts`

- [ ] **Step 1: Create `main.ts`**

```typescript
import { Plugin, TAbstractFile, TFile, TFolder } from 'obsidian';
import { StateManager } from './src/state-manager';
import { BadgeRenderer } from './src/badge-renderer';
import { SettingsTab } from './src/settings-tab';
import { ReviewMode } from './src/review-mode';

export default class UnreadPlusPlugin extends Plugin {
  stateManager!: StateManager;
  badgeRenderer!: BadgeRenderer;
  reviewMode!: ReviewMode;

  private autoReadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async onload(): Promise<void> {
    this.stateManager = new StateManager(this);
    await this.stateManager.load();

    this.badgeRenderer = new BadgeRenderer(this.app, this.stateManager);
    this.reviewMode = new ReviewMode();

    this.badgeRenderer.start();
    this.registerVaultEvents();
    this.registerWorkspaceEvents();
    this.registerCommands();
    this.registerContextMenu();

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  async onunload(): Promise<void> {
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach(t => clearTimeout(t));
    this.autoReadTimers.clear();
    await this.stateManager.save();
  }

  private registerVaultEvents(): void {
    // Only listen to create events after layout is ready to skip initial vault scan
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on('create', (file: TAbstractFile) => this.onFileCreated(file))
      );
    });

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) =>
        this.onFileRenamed(file, oldPath)
      )
    );

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => this.onFileDeleted(file))
    );
  }

  private registerWorkspaceEvents(): void {
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.badgeRenderer.refresh())
    );

    this.registerEvent(
      this.app.workspace.on('file-open', (file: TFile | null) => this.onFileOpen(file))
    );
  }

  private onFileCreated(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;

    this.stateManager.setStatus(file.path, 'unread');
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private onFileRenamed(file: TAbstractFile, oldPath: string): void {
    this.stateManager.renamePath(oldPath, file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private onFileDeleted(file: TAbstractFile): void {
    this.stateManager.deletePath(file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private onFileOpen(file: TFile | null): void {
    if (!file) return;

    // Cancel any existing timer for this file
    const existing = this.autoReadTimers.get(file.path);
    if (existing) clearTimeout(existing);

    const seconds = this.stateManager.getSettings().autoReadSeconds;
    if (seconds <= 0) return;
    if (!this.stateManager.hasOpenStatus(file.path)) return;

    const timer = setTimeout(() => {
      this.stateManager.clearStatus(file.path);
      this.stateManager.save();
      this.badgeRenderer.refresh();
      this.autoReadTimers.delete(file.path);
    }, seconds * 1000);

    this.autoReadTimers.set(file.path, timer);
  }

  // Called by context menu and commands
  setFileStatus(path: string, statusId: string): void {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  clearFileStatus(path: string): void {
    this.stateManager.clearStatus(path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'mark-all-read',
      name: 'Mark all as read',
      callback: () => {
        this.stateManager.clearAll();
        this.stateManager.save();
        this.badgeRenderer.refresh();
      },
    });

    this.addCommand({
      id: 'mark-current-unread',
      name: 'Mark current file as unread',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.setFileStatus(file.path, 'unread');
        }
        return true;
      },
    });

    this.addCommand({
      id: 'mark-folder-read',
      name: 'Mark all in current folder as read',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          const folder = file.parent?.path ?? '';
          const statuses = this.stateManager.getAllFileStatuses();
          for (const path of Object.keys(statuses)) {
            if (path.startsWith(folder + '/') || path === folder) {
              this.stateManager.clearStatus(path);
            }
          }
          this.stateManager.save();
          this.badgeRenderer.refresh();
        }
        return true;
      },
    });

    this.addCommand({
      id: 'start-review',
      name: 'Start review',
      checkCallback: (checking: boolean) => {
        if (!this.stateManager.getSettings().reviewEnabled) return false;
        if (!checking) {
          this.reviewMode.start(this.stateManager);
          this.reviewMode.next(this.app, this.stateManager, this);
        }
        return true;
      },
    });

    this.addCommand({
      id: 'next-review',
      name: 'Next in review',
      checkCallback: (checking: boolean) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) {
          this.reviewMode.next(this.app, this.stateManager, this);
        }
        return true;
      },
    });
  }

  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        const configs = this.stateManager.getStatusConfigs();
        const current = this.stateManager.getStatus(file.path);

        menu.addSeparator();

        for (const config of configs) {
          if (current?.statusId === config.id) continue;
          menu.addItem(item =>
            item
              .setTitle(`Mark as ${config.label}`)
              .setIcon('circle')
              .onClick(() => this.setFileStatus(file.path, config.id))
          );
        }

        if (current) {
          menu.addItem(item =>
            item
              .setTitle('Mark as read')
              .setIcon('check')
              .onClick(() => this.clearFileStatus(file.path))
          );
        }
      })
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: errors about missing `SettingsTab` and `ReviewMode` — that's fine, they're next.

- [ ] **Step 3: Commit (after stubs added in next tasks)**

Will commit after SettingsTab and ReviewMode stubs are in place.

---

## Task 7: ReviewMode

**Files:**
- Create: `src/review-mode.ts`

- [ ] **Step 1: Create `src/review-mode.ts`**

```typescript
import { App, Notice, TFile } from 'obsidian';
import { StateManager } from './state-manager';
import type UnreadPlusPlugin from '../main';

export class ReviewMode {
  private queue: string[] = [];
  private index = -1;
  private active = false;

  isActive(): boolean {
    return this.active;
  }

  start(stateManager: StateManager): void {
    const settings = stateManager.getSettings();
    const statuses = stateManager.getAllFileStatuses();
    const filterIds = new Set(settings.reviewStatusFilter);

    let entries = Object.entries(statuses).filter(([, s]) => filterIds.has(s.statusId));

    if (settings.reviewOrder === 'created') {
      entries.sort((a, b) => a[1].markedAt - b[1].markedAt);
    } else if (settings.reviewOrder === 'folder') {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      // random
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
    }

    this.queue = entries.map(([path]) => path);
    this.index = -1;
    this.active = this.queue.length > 0;

    if (!this.active) {
      new Notice('Unread+: All clear ✓');
    }
  }

  async next(app: App, stateManager: StateManager, plugin: UnreadPlusPlugin): Promise<void> {
    if (!this.active) return;

    this.index++;

    if (this.index >= this.queue.length) {
      this.active = false;
      this.queue = [];
      new Notice('Unread+: All clear ✓');
      return;
    }

    const path = this.queue[this.index];
    const file = app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      // file was deleted since queue was built — skip
      await this.next(app, stateManager, plugin);
      return;
    }

    await app.workspace.getLeaf(false).openFile(file);

    const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
    if (seconds > 0) {
      setTimeout(() => {
        plugin.clearFileStatus(path);
      }, seconds * 1000);
    }
  }

  stop(): void {
    this.active = false;
    this.queue = [];
    this.index = -1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/review-mode.ts
git commit -m "feat: add ReviewMode with queue, ordering, and auto-mark"
```

---

## Task 8: SettingsTab

**Files:**
- Create: `src/settings-tab.ts`

- [ ] **Step 1: Create `src/settings-tab.ts`**

```typescript
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type UnreadPlusPlugin from '../main';
import { StatusConfig } from './types';

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: UnreadPlusPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderGeneralSection(containerEl);
    this.renderIgnoreSection(containerEl);
    this.renderStatusSection(containerEl);
    this.renderReviewSection(containerEl);
  }

  private renderGeneralSection(el: HTMLElement): void {
    el.createEl('h2', { text: 'General' });

    new Setting(el)
      .setName('Auto-read delay (seconds)')
      .setDesc('Mark a file as read after it has been open this many seconds. Set 0 to disable.')
      .addText(text => {
        text
          .setValue(String(this.plugin.stateManager.getSettings().autoReadSeconds))
          .onChange(async value => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.stateManager.updateSettings({ autoReadSeconds: n });
              await this.plugin.stateManager.save();
            }
          });
      });

    new Setting(el)
      .setName('Show status label in badge')
      .setDesc('Display "● Unread" instead of just "●" next to file names.')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.stateManager.getSettings().badgeShowLabel)
          .onChange(async value => {
            this.plugin.stateManager.updateSettings({ badgeShowLabel: value });
            await this.plugin.stateManager.save();
            this.plugin.badgeRenderer.refresh();
          });
      });
  }

  private renderIgnoreSection(el: HTMLElement): void {
    el.createEl('h2', { text: 'Ignore' });

    new Setting(el)
      .setName('Ignored paths')
      .setDesc('One path prefix per line (e.g. "Templates" or "Archive/old"). Files under these paths are never marked unread.')
      .addTextArea(text => {
        text
          .setValue(this.plugin.stateManager.getSettings().ignorePaths.join('\n'))
          .onChange(async value => {
            const paths = value.split('\n').map(s => s.trim()).filter(Boolean);
            this.plugin.stateManager.updateSettings({ ignorePaths: paths });
            await this.plugin.stateManager.save();
          });
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });

    new Setting(el)
      .setName('Ignored extensions')
      .setDesc('Comma-separated list without dots (e.g. "pdf, png, jpg").')
      .addText(text => {
        text
          .setValue(this.plugin.stateManager.getSettings().ignoreExtensions.join(', '))
          .onChange(async value => {
            const exts = value.split(',').map(s => s.trim()).filter(Boolean);
            this.plugin.stateManager.updateSettings({ ignoreExtensions: exts });
            await this.plugin.stateManager.save();
          });
      });
  }

  private renderStatusSection(el: HTMLElement): void {
    el.createEl('h2', { text: 'Statuses' });
    el.createEl('p', {
      text: 'Each status can be applied via right-click. Statuses marked "Counts as open" appear in folder badges.',
      cls: 'setting-item-description',
    });

    const listEl = el.createDiv({ cls: 'unread-plus-status-list' });
    this.renderStatusList(listEl);

    new Setting(el)
      .addButton(btn =>
        btn
          .setButtonText('Add status')
          .setCta()
          .onClick(async () => {
            const configs = this.plugin.stateManager.getStatusConfigs();
            configs.push({
              id: `status-${Date.now()}`,
              label: 'New Status',
              color: '#888888',
              countsAsOpen: true,
            });
            this.plugin.stateManager.updateStatusConfigs(configs);
            await this.plugin.stateManager.save();
            listEl.empty();
            this.renderStatusList(listEl);
          })
      );
  }

  private renderStatusList(listEl: HTMLElement): void {
    const configs = this.plugin.stateManager.getStatusConfigs();

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const row = listEl.createDiv({ cls: 'unread-plus-status-row' });

      // Color picker
      const colorInput = row.createEl('input', { type: 'color' });
      colorInput.value = config.color;
      colorInput.addEventListener('change', async () => {
        configs[i] = { ...configs[i], color: colorInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });

      // Label input
      const labelInput = row.createEl('input', { type: 'text' });
      labelInput.value = config.label;
      labelInput.placeholder = 'Label';
      labelInput.addEventListener('change', async () => {
        configs[i] = { ...configs[i], label: labelInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
      });

      // Counts as open toggle
      const toggleLabel = row.createEl('label', { cls: 'unread-plus-toggle-label' });
      const toggleInput = toggleLabel.createEl('input', { type: 'checkbox' });
      toggleInput.checked = config.countsAsOpen;
      toggleLabel.createSpan({ text: ' Counts as open' });
      toggleInput.addEventListener('change', async () => {
        configs[i] = { ...configs[i], countsAsOpen: toggleInput.checked };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });

      // Delete button (prevent deleting last status)
      const deleteBtn = row.createEl('button', { text: '✕' });
      deleteBtn.addEventListener('click', async () => {
        if (configs.length <= 1) {
          new Notice('At least one status is required.');
          return;
        }
        configs.splice(i, 1);
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
        listEl.empty();
        this.renderStatusList(listEl);
      });
    }
  }

  private renderReviewSection(el: HTMLElement): void {
    el.createEl('h2', { text: 'Review Mode' });

    new Setting(el)
      .setName('Enable Review Mode')
      .setDesc('Adds "Start Review" and "Next in Review" commands to the command palette.')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.stateManager.getSettings().reviewEnabled)
          .onChange(async value => {
            this.plugin.stateManager.updateSettings({ reviewEnabled: value });
            await this.plugin.stateManager.save();
          });
      });

    new Setting(el)
      .setName('Review order')
      .addDropdown(drop => {
        drop
          .addOption('created', 'By creation date')
          .addOption('folder', 'By folder')
          .addOption('random', 'Random')
          .setValue(this.plugin.stateManager.getSettings().reviewOrder)
          .onChange(async (value: string) => {
            this.plugin.stateManager.updateSettings({
              reviewOrder: value as 'created' | 'folder' | 'random',
            });
            await this.plugin.stateManager.save();
          });
      });

    new Setting(el)
      .setName('Auto-mark read in review (seconds)')
      .setDesc('Automatically mark the current review file as read after this many seconds. Set 0 to disable.')
      .addText(text => {
        text
          .setValue(String(this.plugin.stateManager.getSettings().reviewAutoMarkSeconds))
          .onChange(async value => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.stateManager.updateSettings({ reviewAutoMarkSeconds: n });
              await this.plugin.stateManager.save();
            }
          });
      });

    new Setting(el)
      .setName('Statuses included in review')
      .setDesc('Comma-separated status IDs (e.g. "unread, review").')
      .addText(text => {
        text
          .setValue(this.plugin.stateManager.getSettings().reviewStatusFilter.join(', '))
          .onChange(async value => {
            const ids = value.split(',').map(s => s.trim()).filter(Boolean);
            this.plugin.stateManager.updateSettings({ reviewStatusFilter: ids });
            await this.plugin.stateManager.save();
          });
      });
  }
}
```

- [ ] **Step 2: Type-check everything**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/settings-tab.ts main.ts
git commit -m "feat: add SettingsTab and wire up main plugin"
```

---

## Task 9: styles.css and manifest.json

**Files:**
- Create: `styles.css`
- Create: `manifest.json`

- [ ] **Step 1: Create `styles.css`**

```css
/* ── File dot ── */
.unread-plus-dot {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  font-size: 10px;
  color: var(--dot-color, #FA6300);
  flex-shrink: 0;
}

.unread-plus-dot::before {
  content: '●';
  font-size: 8px;
}

/* ── Folder badge ── */
.unread-plus-folder-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--badge-color, #FA6300);
  flex-shrink: 0;
  opacity: 0.9;
}

/* ── Settings status list ── */
.unread-plus-status-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.unread-plus-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.unread-plus-status-row input[type='color'] {
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.unread-plus-status-row input[type='text'] {
  flex: 1;
  min-width: 80px;
}

.unread-plus-toggle-label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font-size: 12px;
}
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "id": "unread-plus",
  "name": "Unread+",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Marks new files with a dot. Propagates unread counts up the folder tree.",
  "author": "yourname",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

- [ ] **Step 3: Commit**

```bash
git add styles.css manifest.json
git commit -m "feat: add styles and plugin manifest"
```

---

## Task 10: Full build and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all unit tests pass (StateManager + FolderCounter).

- [ ] **Step 2: Build production bundle**

Run: `npm run build`
Expected: `main.js` created, no TypeScript or esbuild errors.

- [ ] **Step 3: Install into test vault**

Copy `main.js`, `manifest.json`, and `styles.css` into your Obsidian test vault at:
`.obsidian/plugins/unread-plus/`

Enable the plugin in Obsidian: Settings → Community plugins → Unread+.

- [ ] **Step 4: Manual test checklist**

Verify each behavior in the running plugin:

**Core marking:**
- [ ] Create a new `.md` file → dot appears on the file in file explorer
- [ ] Create a file inside a folder → folder badge shows `(1)` in correct orange color
- [ ] Create two files in same folder → badge shows `(2)`
- [ ] Create file in nested folder (`a/b/c.md`) → badges appear on `a/b/c`, `a/b`, and `a`

**Right-click menu:**
- [ ] Right-click an unread file → menu shows "Mark as Skip", "Mark as Review", "Mark as read"
- [ ] Click "Mark as read" → dot disappears, folder badge updates
- [ ] Click "Mark as Review" → dot turns blue, folder badge color changes if review is dominant

**Commands (Cmd/Ctrl+P):**
- [ ] "Mark all as read" → all dots and badges disappear
- [ ] "Mark current file as unread" → dot reappears on active file
- [ ] "Mark all in current folder as read" → only that folder's files cleared

**Rename / Move:**
- [ ] Mark a file unread, rename it → dot stays on renamed file
- [ ] Mark a file unread, move it to another folder → dot follows the file, badge updates

**Auto-read:**
- [ ] Set auto-read delay to 3 seconds in Settings
- [ ] Open an unread file → after 3 seconds, dot disappears automatically

**Ignore:**
- [ ] Add "Templates" to ignored paths in Settings
- [ ] Create a file in `Templates/` → no dot appears

**Review mode:**
- [ ] Mark 3 files unread
- [ ] Run "Start Review" → first file opens
- [ ] Run "Next in Review" → second file opens
- [ ] Continue until "All clear ✓" notice appears

**Persistence:**
- [ ] Mark files unread, close Obsidian, reopen → dots are still there

- [ ] **Step 5: Commit final state**

```bash
git add .
git commit -m "feat: complete Unread+ MVP — dots, folder badges, statuses, review mode"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Dot on new file (manual + script) | Task 6: `onFileCreated` |
| Folder propagation with `(3)` counter | Task 4 + Task 5 |
| Auto-read after configurable time | Task 6: `onFileOpen` timer |
| Rename/Move retains unread state | Task 3: `renamePath`, Task 6: `onFileRenamed` |
| Right-click Mark as read / set status | Task 6: `registerContextMenu` |
| Command: Mark all read | Task 6: `mark-all-read` |
| Command: Mark current unread | Task 6: `mark-current-unread` |
| Command: Mark all in folder read | Task 6: `mark-folder-read` |
| Ignore paths + extensions | Task 3: `isIgnored`, Task 6: `onFileCreated` |
| No frontmatter pollution | All — only `plugin.saveData()` is used |
| Configurable status system | Task 2 types, Task 3, Task 8 settings |
| Review mode with hotkey queue | Task 7, Task 6 commands |

All spec requirements are covered. ✓
