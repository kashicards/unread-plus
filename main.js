"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => UnreadPlusPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/types.ts
var DEFAULT_STATUS_CONFIGS = [
  { id: "unread", label: "Unread", color: "#4285F4", countsAsOpen: true },
  { id: "later", label: "Later", color: "#FF8C00", countsAsOpen: true }
];
var DEFAULT_SETTINGS = {
  autoReadSeconds: 0,
  ignorePaths: [],
  ignoreExtensions: ["json"],
  badgeShowLabel: false,
  dotAging: true,
  reviewOrder: "created",
  reviewAutoMarkSeconds: 0
};
var DEFAULT_DATA = {
  version: 4,
  fileStatuses: {},
  statusConfigs: DEFAULT_STATUS_CONFIGS,
  settings: DEFAULT_SETTINGS,
  knownPaths: [],
  lastCloseTime: 0,
  readPaths: [],
  lastOpenPaths: [],
  movedPaths: []
};

// src/state-manager.ts
var StateManager = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.data = structuredClone(DEFAULT_DATA);
    this.saveTimer = null;
  }
  async load() {
    var _a, _b, _c, _d, _e, _f, _g;
    const saved = await this.plugin.loadData();
    if (!saved) return;
    this.data = {
      ...DEFAULT_DATA,
      ...saved,
      settings: { ...DEFAULT_DATA.settings, ...saved.settings },
      statusConfigs: (_a = saved.statusConfigs) != null ? _a : DEFAULT_DATA.statusConfigs,
      fileStatuses: (_b = saved.fileStatuses) != null ? _b : {},
      knownPaths: (_c = saved.knownPaths) != null ? _c : [],
      lastCloseTime: (_d = saved.lastCloseTime) != null ? _d : 0,
      readPaths: (_e = saved.readPaths) != null ? _e : [],
      lastOpenPaths: (_f = saved.lastOpenPaths) != null ? _f : [],
      movedPaths: (_g = saved.movedPaths) != null ? _g : []
    };
    this.migrate();
  }
  migrate() {
    var _a;
    if (((_a = this.data.version) != null ? _a : 1) < 2) {
      const unread = this.data.statusConfigs.find((s) => s.id === "unread");
      if (unread && unread.color === "#FA6300") unread.color = "#4285F4";
      this.data.version = 2;
    }
    if (this.data.version < 3) {
      if (!this.data.settings.ignoreExtensions.includes("json")) {
        this.data.settings.ignoreExtensions.push("json");
      }
      this.data.version = 3;
    }
    if (this.data.version < 4) {
      const ids = this.data.statusConfigs.map((s) => s.id);
      if (ids.includes("skip") || ids.includes("review")) {
        this.data.statusConfigs = this.data.statusConfigs.filter(
          (s) => s.id !== "skip" && s.id !== "review"
        );
        if (!ids.includes("later")) {
          this.data.statusConfigs.push({ id: "later", label: "Later", color: "#FF8C00", countsAsOpen: true });
        }
      }
      this.data.version = 4;
    }
  }
  scheduleSave() {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.plugin.saveData(this.data).catch(() => {
      });
    }, 300);
  }
  async flushSave() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.plugin.saveData(this.data);
  }
  async save() {
    await this.plugin.saveData(this.data);
  }
  // --- File status ---
  setStatus(path, statusId) {
    this.data.fileStatuses[path] = { statusId, markedAt: Date.now() };
    const idx = this.data.readPaths.indexOf(path);
    if (idx !== -1) this.data.readPaths.splice(idx, 1);
  }
  clearStatus(path) {
    delete this.data.fileStatuses[path];
    if (!this.data.readPaths.includes(path)) this.data.readPaths.push(path);
  }
  isExplicitlyRead(path) {
    return this.data.readPaths.includes(path);
  }
  pruneReadPaths(validPaths) {
    this.data.readPaths = this.data.readPaths.filter((p) => validPaths.has(p));
  }
  getStatus(path) {
    return this.data.fileStatuses[path];
  }
  getAllFileStatuses() {
    return { ...this.data.fileStatuses };
  }
  hasOpenStatus(path) {
    var _a, _b;
    if (this.isSnoozed(path)) return false;
    const status = this.getStatus(path);
    if (!status) return false;
    return (_b = (_a = this.getStatusConfig(status.statusId)) == null ? void 0 : _a.countsAsOpen) != null ? _b : false;
  }
  renamePath(oldPath, newPath) {
    const gotStatus = /* @__PURE__ */ new Set();
    for (const [path, status] of Object.entries(this.data.fileStatuses)) {
      if (path === oldPath || path.startsWith(oldPath + "/")) {
        const updated = newPath + path.slice(oldPath.length);
        delete this.data.fileStatuses[path];
        this.data.fileStatuses[updated] = status;
        gotStatus.add(updated);
      }
    }
    const wasKnown = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.data.knownPaths.length; i++) {
      const p = this.data.knownPaths[i];
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        const updated = newPath + p.slice(oldPath.length);
        this.data.knownPaths[i] = updated;
        wasKnown.add(updated);
      }
    }
    const wasRead = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.data.readPaths.length; i++) {
      const p = this.data.readPaths[i];
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        const updated = newPath + p.slice(oldPath.length);
        this.data.readPaths[i] = updated;
        wasRead.add(updated);
      }
    }
    for (const p of wasKnown) {
      if (!gotStatus.has(p) && !wasRead.has(p) && !this.data.readPaths.includes(p)) {
        this.data.readPaths.push(p);
      }
    }
  }
  deletePath(path) {
    for (const key of Object.keys(this.data.fileStatuses)) {
      if (key === path || key.startsWith(path + "/")) {
        delete this.data.fileStatuses[key];
      }
    }
    this.data.readPaths = this.data.readPaths.filter(
      (p) => p !== path && !p.startsWith(path + "/")
    );
  }
  clearAll() {
    for (const path of Object.keys(this.data.fileStatuses)) {
      if (!this.data.readPaths.includes(path)) this.data.readPaths.push(path);
    }
    this.data.fileStatuses = {};
  }
  // --- Snooze ---
  snooze(path, durationMs) {
    const status = this.data.fileStatuses[path];
    if (status) {
      this.data.fileStatuses[path] = { ...status, snoozedUntil: Date.now() + durationMs };
    }
  }
  clearSnooze(path) {
    const status = this.data.fileStatuses[path];
    if (status) {
      delete status.snoozedUntil;
    }
  }
  isSnoozed(path) {
    const s = this.data.fileStatuses[path];
    return !!(s == null ? void 0 : s.snoozedUntil) && s.snoozedUntil > Date.now();
  }
  clearExpiredSnoozes() {
    const now = Date.now();
    for (const status of Object.values(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil <= now) {
        delete status.snoozedUntil;
      }
    }
  }
  nextSnoozeExpiry() {
    const now = Date.now();
    let earliest = null;
    for (const status of Object.values(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil > now) {
        if (earliest === null || status.snoozedUntil < earliest) earliest = status.snoozedUntil;
      }
    }
    return earliest;
  }
  getOpenCounts() {
    var _a, _b;
    const now = Date.now();
    const counts = /* @__PURE__ */ new Map();
    for (const status of Object.values(this.data.fileStatuses)) {
      if (status.snoozedUntil && status.snoozedUntil > now) continue;
      if (!((_a = this.getStatusConfig(status.statusId)) == null ? void 0 : _a.countsAsOpen)) continue;
      counts.set(status.statusId, ((_b = counts.get(status.statusId)) != null ? _b : 0) + 1);
    }
    return this.data.statusConfigs.filter((c) => c.countsAsOpen && counts.has(c.id)).map((c) => ({ config: c, count: counts.get(c.id) }));
  }
  // --- Offline-creation snapshot ---
  getKnownPaths() {
    return new Set(this.data.knownPaths);
  }
  setKnownPaths(paths) {
    this.data.knownPaths = paths;
  }
  getLastCloseTime() {
    return this.data.lastCloseTime;
  }
  setLastCloseTime(ts) {
    this.data.lastCloseTime = ts;
  }
  getLastOpenPaths() {
    return new Set(this.data.lastOpenPaths);
  }
  setLastOpenPaths(paths) {
    this.data.lastOpenPaths = paths;
  }
  // --- Moved paths ---
  addMovedPath(newPath) {
    if (!this.data.movedPaths) this.data.movedPaths = [];
    if (!this.data.movedPaths.includes(newPath)) this.data.movedPaths.push(newPath);
  }
  popMovedPaths() {
    var _a;
    const paths = (_a = this.data.movedPaths) != null ? _a : [];
    this.data.movedPaths = [];
    return paths;
  }
  // --- Status configs ---
  getStatusConfigs() {
    return [...this.data.statusConfigs];
  }
  getStatusConfig(id) {
    return this.data.statusConfigs.find((s) => s.id === id);
  }
  updateStatusConfigs(configs) {
    this.data.statusConfigs = configs;
  }
  // --- Settings ---
  getSettings() {
    return this.data.settings;
  }
  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
  }
  // --- Ignore ---
  isIgnored(path) {
    var _a;
    const { ignorePaths, ignoreExtensions } = this.data.settings;
    if (ignorePaths.some((p) => path === p || path.startsWith(p + "/"))) return true;
    const basename = (_a = path.split("/").pop()) != null ? _a : "";
    const ext = basename.includes(".") ? basename.split(".").pop() : "";
    return ignoreExtensions.includes(ext);
  }
};

// src/folder-counter.ts
function computeFolderCounts(fileStatuses, statusConfigs) {
  var _a;
  const openConfigs = new Map(
    statusConfigs.filter((s) => s.countsAsOpen).map((s) => [s.id, s])
  );
  const folderStatusCounts = /* @__PURE__ */ new Map();
  for (const [path, status] of Object.entries(fileStatuses)) {
    if (!openConfigs.has(status.statusId)) continue;
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join("/");
      if (!folderStatusCounts.has(folderPath)) {
        folderStatusCounts.set(folderPath, /* @__PURE__ */ new Map());
      }
      const counts = folderStatusCounts.get(folderPath);
      counts.set(status.statusId, ((_a = counts.get(status.statusId)) != null ? _a : 0) + 1);
    }
  }
  const result = /* @__PURE__ */ new Map();
  for (const [folderPath, statusCounts] of folderStatusCounts) {
    const segments = statusConfigs.filter((s) => s.countsAsOpen && statusCounts.has(s.id)).map((s) => ({ count: statusCounts.get(s.id), color: s.color }));
    if (segments.length > 0) {
      result.set(folderPath, { segments });
    }
  }
  return result;
}

// src/badge-renderer.ts
var BadgeRenderer = class {
  constructor(app, stateManager) {
    this.app = app;
    this.stateManager = stateManager;
    this.observer = null;
    this.isRendering = false;
  }
  start() {
    this.app.workspace.onLayoutReady(() => {
      this.refresh();
      this.attachObserver();
    });
  }
  stop() {
    var _a;
    (_a = this.observer) == null ? void 0 : _a.disconnect();
    this.observer = null;
    this.clearAll();
  }
  refresh() {
    if (this.isRendering) return;
    const container = this.getExplorerContainer();
    if (!container) return;
    this.isRendering = true;
    this.clearAll(container);
    this.renderFileDots(container);
    this.renderFolderBadges(container);
    this.isRendering = false;
  }
  getExplorerContainer() {
    var _a;
    const leaves = this.app.workspace.getLeavesOfType("file-explorer");
    if (leaves.length === 0) return null;
    const view = leaves[0].view;
    return (_a = view.containerEl) != null ? _a : null;
  }
  clearAll(container) {
    const root = container != null ? container : this.getExplorerContainer();
    if (!root) return;
    root.querySelectorAll(".unread-plus-dot, .unread-plus-folder-badge").forEach((el) => el.remove());
  }
  renderFileDots(container) {
    const configs = this.stateManager.getStatusConfigs();
    const configMap = new Map(configs.map((c) => [c.id, c]));
    const settings = this.stateManager.getSettings();
    container.querySelectorAll(".nav-file-title[data-path]").forEach((titleEl) => {
      const path = titleEl.getAttribute("data-path");
      if (!path) return;
      const status = this.stateManager.getStatus(path);
      if (!status) return;
      if (this.stateManager.isSnoozed(path)) return;
      const config = configMap.get(status.statusId);
      if (!config) return;
      const dot = activeDocument.createElement("span");
      dot.className = "unread-plus-dot";
      dot.setAttribute("data-status", status.statusId);
      dot.style.setProperty("--dot-color", config.color);
      if (settings.dotAging) {
        const ageDays = (Date.now() - status.markedAt) / 864e5;
        dot.style.opacity = String(Math.max(1 - ageDays * 0.1, 0.4).toFixed(2));
      }
      if (settings.badgeShowLabel) {
        dot.setAttribute("data-label", config.label);
      }
      titleEl.appendChild(dot);
    });
  }
  renderFolderBadges(container) {
    const allStatuses = this.stateManager.getAllFileStatuses();
    const activeStatuses = Object.fromEntries(
      Object.entries(allStatuses).filter(
        ([path]) => !this.stateManager.isSnoozed(path)
      )
    );
    const folderCounts = computeFolderCounts(activeStatuses, this.stateManager.getStatusConfigs());
    container.querySelectorAll(".nav-folder-title[data-path]").forEach((titleEl) => {
      const path = titleEl.getAttribute("data-path");
      if (!path) return;
      const count = folderCounts.get(path);
      if (!count || count.segments.length === 0) return;
      const badge = activeDocument.createElement("span");
      badge.className = "unread-plus-folder-badge";
      for (const seg of count.segments) {
        const span = activeDocument.createElement("span");
        span.textContent = `${seg.count}\u25CF`;
        span.style.color = seg.color;
        badge.appendChild(span);
      }
      titleEl.appendChild(badge);
    });
  }
  attachObserver() {
    const container = this.getExplorerContainer();
    if (!container) return;
    let debounceTimer = null;
    this.observer = new MutationObserver((mutations) => {
      if (this.isRendering) return;
      const isOwnChange = mutations.every((m) => {
        const isOwnNode = (n) => {
          if (n.nodeType !== 1) return false;
          const el = n;
          return el.classList.contains("unread-plus-dot") || el.classList.contains("unread-plus-folder-badge");
        };
        return Array.from(m.addedNodes).every(isOwnNode) && Array.from(m.removedNodes).every(isOwnNode);
      });
      if (isOwnChange) return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.refresh(), 50);
    });
    this.observer.observe(container, { childList: true, subtree: true });
  }
};

// src/settings-tab.ts
var import_obsidian = require("obsidian");
var SettingsTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.renderGeneralSection(containerEl);
    this.renderIgnoreSection(containerEl);
    this.renderStatusSection(containerEl);
    this.renderReviewSection(containerEl);
  }
  renderGeneralSection(el) {
    new import_obsidian.Setting(el).setName("General").setHeading();
    new import_obsidian.Setting(el).setName("Auto-read delay (seconds)").setDesc("Mark a file as read after it has been open this many seconds. Set 0 to disable.").addText((text) => {
      text.setValue(String(this.plugin.stateManager.getSettings().autoReadSeconds)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) {
          this.plugin.stateManager.updateSettings({ autoReadSeconds: n });
          await this.plugin.stateManager.save();
        }
      });
    });
    new import_obsidian.Setting(el).setName("Show status label in badge").setDesc('Display "\u25CF Unread" instead of just "\u25CF" next to file names.').addToggle((toggle) => {
      toggle.setValue(this.plugin.stateManager.getSettings().badgeShowLabel).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({ badgeShowLabel: value });
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
    });
    new import_obsidian.Setting(el).setName("Dot aging").setDesc("Dots start at full opacity and fade slightly each day. Keeps old unread files visually subtle.").addToggle((toggle) => {
      toggle.setValue(this.plugin.stateManager.getSettings().dotAging).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({ dotAging: value });
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
    });
  }
  renderIgnoreSection(el) {
    new import_obsidian.Setting(el).setName("Ignore").setHeading();
    new import_obsidian.Setting(el).setName("Ignored paths").setDesc('One path prefix per line (e.g. "Templates" or "Archive/old"). Files under these paths are never marked unread.').addTextArea((text) => {
      text.setValue(this.plugin.stateManager.getSettings().ignorePaths.join("\n")).onChange(async (value) => {
        const paths = value.split("\n").map((s) => s.trim()).filter(Boolean);
        this.plugin.stateManager.updateSettings({ ignorePaths: paths });
        await this.plugin.stateManager.save();
      });
      text.inputEl.rows = 4;
      text.inputEl.setCssStyles({ width: "100%" });
    });
    new import_obsidian.Setting(el).setName("Ignored extensions").setDesc('Comma-separated list without dots (e.g. "pdf, png, jpg").').addText((text) => {
      text.setValue(this.plugin.stateManager.getSettings().ignoreExtensions.join(", ")).onChange(async (value) => {
        const exts = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.stateManager.updateSettings({ ignoreExtensions: exts });
        await this.plugin.stateManager.save();
      });
    });
  }
  renderStatusSection(el) {
    new import_obsidian.Setting(el).setName("Statuses").setHeading();
    el.createEl("p", {
      text: 'Each status can be applied via right-click. Statuses marked "Counts as open" appear in folder badges.',
      cls: "setting-item-description"
    });
    const listEl = el.createDiv({ cls: "unread-plus-status-list" });
    this.renderStatusList(listEl);
    new import_obsidian.Setting(el).addButton(
      (btn) => btn.setButtonText("Add status").setCta().onClick(async () => {
        const configs = this.plugin.stateManager.getStatusConfigs();
        configs.push({
          id: `status-${Date.now()}`,
          label: "New Status",
          color: "#888888",
          countsAsOpen: true
        });
        this.plugin.stateManager.updateStatusConfigs(configs);
        await this.plugin.stateManager.save();
        listEl.empty();
        this.renderStatusList(listEl);
      })
    );
  }
  renderStatusList(listEl) {
    const configs = this.plugin.stateManager.getStatusConfigs();
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const row = listEl.createDiv({ cls: "unread-plus-status-row" });
      const colorInput = row.createEl("input", { type: "color" });
      colorInput.value = config.color;
      colorInput.addEventListener("change", () => {
        configs[i] = { ...configs[i], color: colorInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
        this.plugin.badgeRenderer.refresh();
      });
      const labelInput = row.createEl("input", { type: "text" });
      labelInput.value = config.label;
      labelInput.placeholder = "Label";
      labelInput.addEventListener("change", () => {
        configs[i] = { ...configs[i], label: labelInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
      });
      const toggleLabel = row.createEl("label", { cls: "unread-plus-toggle-label" });
      const toggleInput = toggleLabel.createEl("input", { type: "checkbox" });
      toggleInput.checked = config.countsAsOpen;
      toggleLabel.createSpan({ text: " Counts as open" });
      toggleInput.addEventListener("change", () => {
        configs[i] = { ...configs[i], countsAsOpen: toggleInput.checked };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
        this.plugin.badgeRenderer.refresh();
      });
      const deleteBtn = row.createEl("button", { text: "\u2715" });
      deleteBtn.addEventListener("click", () => {
        if (configs.length <= 1) {
          new import_obsidian.Notice("At least one status is required.");
          return;
        }
        configs.splice(i, 1);
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
        listEl.empty();
        this.renderStatusList(listEl);
      });
    }
  }
  renderReviewSection(el) {
    new import_obsidian.Setting(el).setName("Queue (Ctrl+Shift+U)").setHeading();
    el.createEl("p", {
      text: 'Opens all files with a status (Unread, Later, \u2026) one by one. "Counts as open" on each status controls which ones appear here.',
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(el).setName("Queue order").addDropdown((drop) => {
      drop.addOption("created", "Oldest first").addOption("folder", "By folder").addOption("random", "Random").setValue(this.plugin.stateManager.getSettings().reviewOrder).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({
          reviewOrder: value
        });
        await this.plugin.stateManager.save();
      });
    });
    new import_obsidian.Setting(el).setName("Auto-mark as read (seconds)").setDesc("Auto-clear status after this many seconds of the file being open. 0 = off.").addText((text) => {
      text.setValue(String(this.plugin.stateManager.getSettings().reviewAutoMarkSeconds)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) {
          this.plugin.stateManager.updateSettings({ reviewAutoMarkSeconds: n });
          await this.plugin.stateManager.save();
        }
      });
    });
  }
};

// src/review-mode.ts
var import_obsidian2 = require("obsidian");
var ReviewMode = class {
  constructor() {
    this.queue = [];
    this.index = -1;
    this.active = false;
    this.autoMarkTimer = null;
  }
  isActive() {
    return this.active;
  }
  start(stateManager) {
    const settings = stateManager.getSettings();
    const statuses = stateManager.getAllFileStatuses();
    const openIds = new Set(
      stateManager.getStatusConfigs().filter((c) => c.countsAsOpen).map((c) => c.id)
    );
    let entries = Object.entries(statuses).filter(([, s]) => openIds.has(s.statusId));
    if (settings.reviewOrder === "created") {
      entries.sort((a, b) => a[1].markedAt - b[1].markedAt);
    } else if (settings.reviewOrder === "folder") {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
    }
    this.queue = entries.map(([path]) => path);
    this.index = -1;
    this.active = this.queue.length > 0;
    if (!this.active) {
      new import_obsidian2.Notice("Unread+: All clear \u2713");
    }
  }
  async next(app, stateManager, plugin) {
    if (!this.active) return;
    while (true) {
      this.index++;
      if (this.index >= this.queue.length) {
        this.stop();
        new import_obsidian2.Notice("Unread+: All clear \u2713");
        return;
      }
      const path = this.queue[this.index];
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian2.TFile)) {
        continue;
      }
      await app.workspace.getLeaf(false).openFile(file);
      const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
      if (seconds > 0) {
        if (this.autoMarkTimer !== null) window.clearTimeout(this.autoMarkTimer);
        this.autoMarkTimer = window.setTimeout(() => {
          plugin.clearFileStatus(path);
          this.autoMarkTimer = null;
        }, seconds * 1e3);
      }
      return;
    }
  }
  stop() {
    if (this.autoMarkTimer !== null) {
      window.clearTimeout(this.autoMarkTimer);
      this.autoMarkTimer = null;
    }
    this.active = false;
    this.queue = [];
    this.index = -1;
  }
};

// main.ts
var UnreadPlusPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.autoReadTimers = /* @__PURE__ */ new Map();
    this.recentlyRenamedPaths = /* @__PURE__ */ new Set();
    this.sessionOpenedPaths = /* @__PURE__ */ new Set();
    this.isLayoutReady = false;
    this.snoozeWakeupTimer = null;
  }
  async onload() {
    this.stateManager = new StateManager(this);
    await this.stateManager.load();
    this.badgeRenderer = new BadgeRenderer(this.app, this.stateManager);
    this.reviewMode = new ReviewMode();
    this.statusBarItem = this.addStatusBarItem();
    this.badgeRenderer.start();
    this.registerVaultEvents();
    this.registerWorkspaceEvents();
    this.registerCommands();
    this.registerContextMenu();
    this.addSettingTab(new SettingsTab(this.app, this));
  }
  onunload() {
    this.reviewMode.stop();
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach((t) => window.clearTimeout(t));
    this.autoReadTimers.clear();
    if (this.snoozeWakeupTimer !== null) window.clearTimeout(this.snoozeWakeupTimer);
    this.stateManager.setKnownPaths(this.app.vault.getFiles().map((f) => f.path));
    this.stateManager.setLastCloseTime(Date.now());
    this.stateManager.setLastOpenPaths([
      ...this.getOpenFilePaths(),
      ...this.sessionOpenedPaths
    ]);
    void this.stateManager.flushSave();
  }
  getOpenFilePaths() {
    const paths = /* @__PURE__ */ new Set();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof import_obsidian3.FileView && leaf.view.file) {
        paths.add(leaf.view.file.path);
      }
    });
    return paths;
  }
  registerVaultEvents() {
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!this.isLayoutReady) return;
        this.onFileCreated(file);
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.isLayoutReady = true;
      for (const path of this.getOpenFilePaths()) this.sessionOpenedPaths.add(path);
      this.detectOfflineCreations();
    });
    this.registerEvent(
      this.app.vault.on(
        "rename",
        (file, oldPath) => this.onFileRenamed(file, oldPath)
      )
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => this.onFileDeleted(file))
    );
  }
  registerWorkspaceEvents() {
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.badgeRenderer.refresh())
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => this.onFileOpen(file))
    );
  }
  detectOfflineCreations() {
    this.stateManager.clearExpiredSnoozes();
    const known = this.stateManager.getKnownPaths();
    const lastClose = this.stateManager.getLastCloseTime();
    const lastOpen = this.stateManager.getLastOpenPaths();
    const currentFiles = this.app.vault.getFiles();
    const moved = this.stateManager.popMovedPaths();
    const isRecentlyMoved = (path) => moved.some((p) => path === p || path.startsWith(p + "/"));
    this.stateManager.pruneReadPaths(new Set(currentFiles.map((f) => f.path)));
    const hasBaseline = known.size > 0 || lastClose > 0;
    if (hasBaseline) {
      for (const file of currentFiles) {
        if (this.stateManager.isIgnored(file.path)) continue;
        if (this.stateManager.getStatus(file.path)) continue;
        if (this.stateManager.isExplicitlyRead(file.path)) continue;
        if (isRecentlyMoved(file.path)) continue;
        const isNewPath = known.size > 0 && !known.has(file.path) && lastClose > 0 && file.stat.mtime > lastClose;
        const isModifiedOffline = lastClose > 0 && file.stat.mtime > lastClose && !lastOpen.has(file.path);
        if (isNewPath || isModifiedOffline) {
          this.stateManager.setStatus(file.path, "unread");
        }
      }
    }
    if (currentFiles.length > 0) {
      this.stateManager.setKnownPaths(currentFiles.map((f) => f.path));
      this.stateManager.scheduleSave();
    }
    this.scheduleSnoozeWakeup();
    window.setTimeout(() => this.refreshUI(), 150);
  }
  onFileCreated(file) {
    if (!(file instanceof import_obsidian3.TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;
    if (this.getOpenFilePaths().has(file.path)) return;
    if (this.stateManager.isExplicitlyRead(file.path)) return;
    if (this.isUnderRecentlyRenamedPath(file.path)) return;
    if (this.stateManager.getKnownPaths().has(file.path)) return;
    window.setTimeout(() => {
      if (this.getOpenFilePaths().has(file.path)) return;
      if (this.stateManager.isExplicitlyRead(file.path)) return;
      if (this.isUnderRecentlyRenamedPath(file.path)) return;
      if (this.stateManager.getKnownPaths().has(file.path)) return;
      this.stateManager.setStatus(file.path, "unread");
      this.stateManager.scheduleSave();
      this.refreshUI();
    }, 150);
  }
  onFileRenamed(file, oldPath) {
    for (const p of [...this.sessionOpenedPaths]) {
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        this.sessionOpenedPaths.delete(p);
        this.sessionOpenedPaths.add(file.path + p.slice(oldPath.length));
      }
    }
    const hadStatusBefore = this.stateManager.getStatus(oldPath);
    this.stateManager.renamePath(oldPath, file.path);
    if (!hadStatusBefore) {
      const newStatus = this.stateManager.getStatus(file.path);
      if (newStatus) this.stateManager.clearStatus(file.path);
    }
    this.stateManager.addMovedPath(file.path);
    this.recentlyRenamedPaths.add(file.path);
    window.setTimeout(() => this.recentlyRenamedPaths.delete(file.path), 1e3);
    this.stateManager.save().catch(() => {
    });
    this.refreshUI();
  }
  isUnderRecentlyRenamedPath(filePath) {
    for (const p of this.recentlyRenamedPaths) {
      if (filePath === p || filePath.startsWith(p + "/")) return true;
    }
    return false;
  }
  onFileDeleted(file) {
    this.stateManager.deletePath(file.path);
    this.stateManager.scheduleSave();
    this.refreshUI();
  }
  onFileOpen(file) {
    if (!file) return;
    this.sessionOpenedPaths.add(file.path);
    const existing = this.autoReadTimers.get(file.path);
    if (existing) window.clearTimeout(existing);
    const seconds = this.stateManager.getSettings().autoReadSeconds;
    if (seconds <= 0) return;
    if (!this.stateManager.hasOpenStatus(file.path)) return;
    const timer = window.setTimeout(() => {
      this.stateManager.clearStatus(file.path);
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.autoReadTimers.delete(file.path);
    }, seconds * 1e3);
    this.autoReadTimers.set(file.path, timer);
  }
  setFileStatus(path, statusId) {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save().catch(() => {
    });
    this.refreshUI();
  }
  clearFileStatus(path) {
    this.stateManager.clearStatus(path);
    this.stateManager.save().catch(() => {
    });
    this.refreshUI();
  }
  registerCommands() {
    this.addCommand({
      id: "mark-all-read",
      name: "Mark all as read",
      callback: () => {
        this.stateManager.clearAll();
        this.stateManager.save().catch(() => {
        });
        this.refreshUI();
      }
    });
    this.addCommand({
      id: "mark-current-unread",
      name: "Mark current file as unread",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.setFileStatus(file.path, "unread");
        return true;
      }
    });
    this.addCommand({
      id: "mark-folder-read",
      name: "Mark all in current folder as read",
      checkCallback: (checking) => {
        var _a, _b;
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          const folder = (_b = (_a = file.parent) == null ? void 0 : _a.path) != null ? _b : "";
          for (const path of Object.keys(this.stateManager.getAllFileStatuses())) {
            const inFolder = folder === "" ? !path.includes("/") : path.startsWith(folder + "/");
            if (inFolder) this.stateManager.clearStatus(path);
          }
          this.stateManager.save().catch(() => {
          });
          this.refreshUI();
        }
        return true;
      }
    });
    this.addCommand({
      id: "open-next-unread",
      name: "Open next unread",
      callback: () => {
        if (!this.reviewMode.isActive()) this.reviewMode.start(this.stateManager);
        void this.reviewMode.next(this.app, this.stateManager, this);
      }
    });
    this.addCommand({
      id: "start-review",
      name: "Restart queue from beginning",
      callback: () => {
        this.reviewMode.start(this.stateManager);
        void this.reviewMode.next(this.app, this.stateManager, this);
      }
    });
    this.addCommand({
      id: "next-review",
      name: "Next in review",
      checkCallback: (checking) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) void this.reviewMode.next(this.app, this.stateManager, this);
        return true;
      }
    });
  }
  refreshUI() {
    this.badgeRenderer.refresh();
    this.updateStatusBar();
  }
  updateStatusBar() {
    const counts = this.stateManager.getOpenCounts();
    this.statusBarItem.empty();
    if (counts.length === 0) {
      this.statusBarItem.addClass("unread-plus-hidden");
      return;
    }
    this.statusBarItem.removeClass("unread-plus-hidden");
    for (const { config, count } of counts) {
      const span = this.statusBarItem.createSpan({ cls: "unread-plus-status-bar-dot" });
      span.setCssStyles({ color: config.color });
      span.textContent = `${count}\u25CF`;
    }
  }
  scheduleSnoozeWakeup() {
    if (this.snoozeWakeupTimer !== null) window.clearTimeout(this.snoozeWakeupTimer);
    const next = this.stateManager.nextSnoozeExpiry();
    if (next === null) return;
    const delay = Math.max(next - Date.now(), 0);
    this.snoozeWakeupTimer = window.setTimeout(() => {
      this.snoozeWakeupTimer = null;
      this.stateManager.clearExpiredSnoozes();
      this.stateManager.scheduleSave();
      this.refreshUI();
      this.scheduleSnoozeWakeup();
    }, delay);
  }
  makeMenuDot(color, char = "\u25CF") {
    const span = activeDocument.createElement("span");
    span.textContent = char + " ";
    span.setCssStyles({ color, fontSize: "10px", marginRight: "2px" });
    return span;
  }
  registerContextMenu() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian3.TFile)) return;
        const configs = this.stateManager.getStatusConfigs();
        const current = this.stateManager.getStatus(file.path);
        menu.addSeparator();
        for (const config of configs) {
          if ((current == null ? void 0 : current.statusId) === config.id) continue;
          menu.addItem((item) => {
            const frag = activeDocument.createDocumentFragment();
            frag.appendChild(this.makeMenuDot(config.color));
            frag.appendChild(activeDocument.createTextNode(config.label));
            item.setTitle(frag).onClick(() => this.setFileStatus(file.path, config.id));
          });
        }
        if (current) {
          const currentConfig = configs.find((c) => c.id === current.statusId);
          if (this.stateManager.isSnoozed(file.path)) {
            menu.addItem(
              (item) => item.setTitle("Unsnooze").setIcon("bell").onClick(() => {
                this.stateManager.clearSnooze(file.path);
                this.stateManager.save().catch(() => {
                });
                this.scheduleSnoozeWakeup();
                this.refreshUI();
              })
            );
          } else {
            menu.addSeparator();
            for (const [label, days] of [["Snooze 1 day", 1], ["Snooze 3 days", 3], ["Snooze 1 week", 7]]) {
              menu.addItem(
                (item) => item.setTitle(label).setIcon("clock").onClick(() => {
                  this.stateManager.snooze(file.path, days * 864e5);
                  this.stateManager.save().catch(() => {
                  });
                  this.scheduleSnoozeWakeup();
                  this.refreshUI();
                })
              );
            }
          }
          menu.addSeparator();
          menu.addItem((item) => {
            const frag = activeDocument.createDocumentFragment();
            if (currentConfig) frag.appendChild(this.makeMenuDot(currentConfig.color, "\u25CB"));
            frag.appendChild(activeDocument.createTextNode("Mark as read"));
            item.setTitle(frag).onClick(() => this.clearFileStatus(file.path));
          });
        }
      })
    );
  }
};
