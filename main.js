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
var import_obsidian7 = require("obsidian");

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
  reviewAutoMarkSeconds: 0,
  newFileGraceSeconds: 2
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
  movedPaths: [],
  onboardingShown: false
};

// src/state-manager.ts
var StateManager = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.data = structuredClone(DEFAULT_DATA);
    this.saveTimer = null;
  }
  async load() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
      movedPaths: (_g = saved.movedPaths) != null ? _g : [],
      // Any pre-existing saved data means this is an upgrade, not a fresh
      // install — don't retroactively show onboarding to existing users.
      onboardingShown: (_h = saved.onboardingShown) != null ? _h : true
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
  pruneFileStatuses(validPaths) {
    for (const path of Object.keys(this.data.fileStatuses)) {
      if (!validPaths.has(path)) delete this.data.fileStatuses[path];
    }
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
  // --- Onboarding ---
  hasSeenOnboarding() {
    return this.data.onboardingShown;
  }
  markOnboardingSeen() {
    this.data.onboardingShown = true;
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
    const segments = statusConfigs.filter((s) => s.countsAsOpen && statusCounts.has(s.id)).map((s) => ({ count: statusCounts.get(s.id), color: s.color, label: s.label, icon: s.icon }));
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
      if (config.icon) {
        dot.addClass("unread-plus-dot--custom-icon");
        dot.textContent = config.icon;
      }
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
      var _a;
      const path = titleEl.getAttribute("data-path");
      if (!path) return;
      const count = folderCounts.get(path);
      if (!count || count.segments.length === 0) return;
      const badge = activeDocument.createElement("span");
      badge.className = "unread-plus-folder-badge";
      for (const seg of count.segments) {
        const span = activeDocument.createElement("span");
        span.textContent = `${seg.count}${(_a = seg.icon) != null ? _a : "\u25CF"}`;
        span.style.color = seg.color;
        span.title = `${seg.count} ${seg.label}`;
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
var import_obsidian3 = require("obsidian");

// src/confirm-modal.ts
var import_obsidian = require("obsidian");
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, message, onConfirm) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close())).addButton(
      (btn) => btn.setButtonText("Confirm").setWarning().onClick(() => {
        this.onConfirm();
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/format-duration.ts
var MINUTE = 6e4;
var HOUR = 36e5;
var DAY = 864e5;
function formatRemaining(ms) {
  if (ms <= 0) return "now";
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor(ms % DAY / HOUR);
    return `${days}d ${hours}h`;
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes2 = Math.floor(ms % HOUR / MINUTE);
    return `${hours}h ${minutes2}m`;
  }
  const minutes = Math.max(1, Math.floor(ms / MINUTE));
  return `${minutes}m`;
}

// src/folder-suggest.ts
var import_obsidian2 = require("obsidian");
var FolderSuggest = class extends import_obsidian2.AbstractInputSuggest {
  getSuggestions(query) {
    const lowerQuery = query.toLowerCase();
    const folders = [];
    for (const file of this.app.vault.getAllLoadedFiles()) {
      if (file instanceof import_obsidian2.TFolder && file.path.toLowerCase().includes(lowerQuery)) {
        folders.push(file);
      }
    }
    return folders.slice(0, this.limit);
  }
  renderSuggestion(folder, el) {
    el.setText(folder.path || "/");
  }
};

// src/settings-tab.ts
var SettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.renderGeneralSection(containerEl);
    this.renderAutoMarkSection(containerEl);
    this.renderIgnoreSection(containerEl);
    this.renderStatusSection(containerEl);
    this.renderReviewSection(containerEl);
    this.renderSnoozeSection(containerEl);
    this.renderResetSection(containerEl);
  }
  renderGeneralSection(el) {
    new import_obsidian3.Setting(el).setName("New file grace period (seconds)").setDesc("How long after creating a file to watch whether it becomes the active file, before marking it unread. Increase if you see false unread marks when creating and leaving files very quickly. Max 10.").addText((text) => {
      text.setValue(String(this.plugin.stateManager.getSettings().newFileGraceSeconds)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0 && n <= 10) {
          this.plugin.stateManager.updateSettings({ newFileGraceSeconds: n });
          await this.plugin.stateManager.save();
        }
      });
    });
    new import_obsidian3.Setting(el).setName("Show status label in badge").setDesc('Display "\u25CF Unread" instead of just "\u25CF" next to file names.').addToggle((toggle) => {
      toggle.setValue(this.plugin.stateManager.getSettings().badgeShowLabel).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({ badgeShowLabel: value });
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
    });
    new import_obsidian3.Setting(el).setName("Dot aging").setDesc("Dots start at full opacity and fade slightly each day. Keeps old unread files visually subtle.").addToggle((toggle) => {
      toggle.setValue(this.plugin.stateManager.getSettings().dotAging).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({ dotAging: value });
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
    });
  }
  renderAutoMarkSection(el) {
    new import_obsidian3.Setting(el).setName("Auto-mark as read").setHeading();
    el.createEl("p", {
      text: "Two independent timers for automatically clearing a file's status \u2014 one for everyday browsing, one only while stepping through the review queue.",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(el).setName("Everywhere (seconds)").setDesc("Mark ANY file as read after it has been open this many seconds \u2014 applies during normal browsing too, not just the review queue. Set 0 to disable.").addText((text) => {
      text.setValue(String(this.plugin.stateManager.getSettings().autoReadSeconds)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) {
          this.plugin.stateManager.updateSettings({ autoReadSeconds: n });
          await this.plugin.stateManager.save();
        }
      });
    });
    new import_obsidian3.Setting(el).setName("During review queue only (seconds)").setDesc("While stepping through the review queue with Next/Previous in review, auto-clear each file's status after this many seconds. 0 = off.").addText((text) => {
      text.setValue(String(this.plugin.stateManager.getSettings().reviewAutoMarkSeconds)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) {
          this.plugin.stateManager.updateSettings({ reviewAutoMarkSeconds: n });
          await this.plugin.stateManager.save();
        }
      });
    });
  }
  renderIgnoreSection(el) {
    new import_obsidian3.Setting(el).setName("Ignore").setHeading();
    new import_obsidian3.Setting(el).setName("Ignored paths").setDesc("Files under these folders are never marked unread. Type to search vault folders, then pick a suggestion or press Enter to add.").addText((text) => {
      text.setPlaceholder("Search folders\u2026");
      const suggest = new FolderSuggest(this.app, text.inputEl);
      suggest.onSelect((folder) => {
        this.addIgnoredPath(folder.path);
        text.setValue("");
      });
      text.inputEl.addEventListener("keydown", (evt) => {
        if (evt.key !== "Enter") return;
        evt.preventDefault();
        const value = text.getValue().trim();
        if (value) {
          this.addIgnoredPath(value);
          text.setValue("");
        }
      });
    });
    const ignorePathListEl = el.createDiv({ cls: "unread-plus-ignore-path-list" });
    for (const path of this.plugin.stateManager.getSettings().ignorePaths) {
      const row = ignorePathListEl.createDiv({ cls: "unread-plus-ignore-path-row" });
      row.createSpan({ text: path });
      const removeBtn = row.createEl("button", { text: "\u2715" });
      removeBtn.addEventListener("click", () => this.removeIgnoredPath(path));
    }
    new import_obsidian3.Setting(el).setName("Ignored extensions").setDesc('Comma-separated list without dots (e.g. "pdf, png, jpg").').addText((text) => {
      text.setValue(this.plugin.stateManager.getSettings().ignoreExtensions.join(", ")).onChange(async (value) => {
        const exts = value.split(",").map((s) => s.trim()).filter(Boolean);
        this.plugin.stateManager.updateSettings({ ignoreExtensions: exts });
        await this.plugin.stateManager.save();
      });
    });
  }
  addIgnoredPath(path) {
    const current = this.plugin.stateManager.getSettings().ignorePaths;
    if (current.includes(path)) return;
    this.plugin.stateManager.updateSettings({ ignorePaths: [...current, path] });
    this.plugin.stateManager.save().catch(() => {
    });
    this.display();
  }
  removeIgnoredPath(path) {
    const updated = this.plugin.stateManager.getSettings().ignorePaths.filter((p) => p !== path);
    this.plugin.stateManager.updateSettings({ ignorePaths: updated });
    this.plugin.stateManager.save().catch(() => {
    });
    this.display();
  }
  renderStatusSection(el) {
    new import_obsidian3.Setting(el).setName("Statuses").setHeading();
    el.createEl("p", {
      text: 'Each status can be applied via right-click. Statuses marked "Counts as open" appear in folder badges.',
      cls: "setting-item-description"
    });
    const listEl = el.createDiv({ cls: "unread-plus-status-list" });
    this.renderStatusList(listEl);
    new import_obsidian3.Setting(el).addButton(
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
    var _a;
    const configs = this.plugin.stateManager.getStatusConfigs();
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const row = listEl.createDiv({ cls: "unread-plus-status-row" });
      const handle = row.createSpan({ cls: "unread-plus-drag-handle", text: "\u283F" });
      handle.setAttribute("draggable", "true");
      handle.addEventListener("dragstart", (evt) => {
        var _a2;
        (_a2 = evt.dataTransfer) == null ? void 0 : _a2.setData("text/plain", String(i));
        row.addClass("unread-plus-dragging");
      });
      handle.addEventListener("dragend", () => {
        row.removeClass("unread-plus-dragging");
      });
      row.addEventListener("dragover", (evt) => {
        evt.preventDefault();
      });
      row.addEventListener("drop", (evt) => {
        var _a2;
        evt.preventDefault();
        const fromIndex = Number((_a2 = evt.dataTransfer) == null ? void 0 : _a2.getData("text/plain"));
        if (isNaN(fromIndex) || fromIndex === i) return;
        const [moved] = configs.splice(fromIndex, 1);
        configs.splice(i, 0, moved);
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
        this.plugin.badgeRenderer.refresh();
        listEl.empty();
        this.renderStatusList(listEl);
      });
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
      const iconInput = row.createEl("input", { type: "text", cls: "unread-plus-icon-input" });
      iconInput.value = (_a = config.icon) != null ? _a : "";
      iconInput.placeholder = "\u25CF";
      iconInput.maxLength = 4;
      iconInput.addEventListener("change", () => {
        const icon = iconInput.value.trim();
        configs[i] = { ...configs[i], icon: icon || void 0 };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {
        });
        this.plugin.badgeRenderer.refresh();
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
          new import_obsidian3.Notice("At least one status is required.");
          return;
        }
        const affectedPaths = Object.entries(this.plugin.stateManager.getAllFileStatuses()).filter(([, status]) => status.statusId === config.id).map(([path]) => path);
        const message = affectedPaths.length > 0 ? `Delete status "${config.label}"? ${affectedPaths.length} file(s) currently have this status and will be marked as read.` : `Delete status "${config.label}"?`;
        new ConfirmModal(this.app, message, () => {
          for (const path of affectedPaths) {
            this.plugin.stateManager.clearStatus(path);
          }
          configs.splice(i, 1);
          this.plugin.stateManager.updateStatusConfigs([...configs]);
          this.plugin.stateManager.save().catch(() => {
          });
          this.plugin.badgeRenderer.refresh();
          listEl.empty();
          this.renderStatusList(listEl);
        }).open();
      });
    }
  }
  renderReviewSection(el) {
    new import_obsidian3.Setting(el).setName("Queue (Ctrl+Shift+U)").setHeading();
    el.createEl("p", {
      text: 'Opens all files with a status (Unread, Later, \u2026) one by one. "Counts as open" on each status controls which ones appear here.',
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(el).setName("Queue order").addDropdown((drop) => {
      drop.addOption("created", "Oldest first").addOption("folder", "By folder").addOption("random", "Random").setValue(this.plugin.stateManager.getSettings().reviewOrder).onChange(async (value) => {
        this.plugin.stateManager.updateSettings({
          reviewOrder: value
        });
        await this.plugin.stateManager.save();
      });
    });
  }
  renderSnoozeSection(el) {
    new import_obsidian3.Setting(el).setName("Snoozed files").setHeading();
    const now = Date.now();
    const snoozed = Object.entries(this.plugin.stateManager.getAllFileStatuses()).filter(
      (entry) => !!entry[1].snoozedUntil && entry[1].snoozedUntil > now
    ).sort((a, b) => a[1].snoozedUntil - b[1].snoozedUntil);
    if (snoozed.length === 0) {
      el.createEl("p", {
        text: "No files are currently snoozed.",
        cls: "setting-item-description"
      });
      return;
    }
    for (const [path, status] of snoozed) {
      new import_obsidian3.Setting(el).setName(path).setDesc(`Wakes up in ${formatRemaining(status.snoozedUntil - now)}`).addButton(
        (btn) => btn.setButtonText("Unsnooze").onClick(async () => {
          this.plugin.stateManager.clearSnooze(path);
          await this.plugin.stateManager.save();
          this.plugin.badgeRenderer.refresh();
          this.display();
        })
      );
    }
  }
  renderResetSection(el) {
    new import_obsidian3.Setting(el).setName("Danger zone").setHeading();
    new import_obsidian3.Setting(el).setName("Reset to defaults").setDesc("Resets all settings and statuses back to their defaults. This cannot be undone.").addButton(
      (btn) => btn.setButtonText("Reset to defaults").setWarning().onClick(() => {
        new ConfirmModal(
          this.app,
          "This will reset all settings and statuses to their defaults. Continue?",
          async () => {
            this.plugin.stateManager.updateSettings(structuredClone(DEFAULT_SETTINGS));
            this.plugin.stateManager.updateStatusConfigs(structuredClone(DEFAULT_STATUS_CONFIGS));
            await this.plugin.stateManager.save();
            this.plugin.badgeRenderer.refresh();
            this.display();
          }
        ).open();
      })
    );
  }
};

// src/review-mode.ts
var import_obsidian4 = require("obsidian");

// src/sort-entries.ts
function sortEntries(entries, order) {
  const copy = [...entries];
  if (order === "created") {
    copy.sort((a, b) => a[1].markedAt - b[1].markedAt);
  } else if (order === "folder") {
    copy.sort((a, b) => a[0].localeCompare(b[0]));
  } else {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}

// src/review-mode.ts
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
    entries = sortEntries(entries, settings.reviewOrder);
    this.queue = entries.map(([path]) => path);
    this.index = -1;
    this.active = this.queue.length > 0;
    if (!this.active) {
      new import_obsidian4.Notice("Unread+: All clear \u2713");
    }
  }
  async next(app, stateManager, plugin) {
    if (!this.active) return;
    while (true) {
      this.index++;
      if (this.index >= this.queue.length) {
        this.stop();
        new import_obsidian4.Notice("Unread+: All clear \u2713");
        return;
      }
      if (await this.tryOpenCurrent(app, stateManager, plugin)) return;
    }
  }
  async previous(app, stateManager, plugin) {
    if (!this.active) return;
    while (true) {
      if (this.index <= 0) {
        new import_obsidian4.Notice("Unread+: Already at the first file");
        return;
      }
      this.index--;
      if (await this.tryOpenCurrent(app, stateManager, plugin)) return;
    }
  }
  // Opens the file at the current index and starts the auto-mark timer if
  // configured. Returns false (without touching this.index) if the file at
  // this index no longer exists, so next()/previous() can keep stepping.
  async tryOpenCurrent(app, stateManager, plugin) {
    const path = this.queue[this.index];
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian4.TFile)) {
      return false;
    }
    await app.workspace.getLeaf(false).openFile(file);
    new import_obsidian4.Notice(`Unread+: ${this.index + 1} von ${this.queue.length}`);
    const seconds = stateManager.getSettings().reviewAutoMarkSeconds;
    if (seconds > 0) {
      if (this.autoMarkTimer !== null) window.clearTimeout(this.autoMarkTimer);
      this.autoMarkTimer = window.setTimeout(() => {
        plugin.clearFileStatus(path);
        this.autoMarkTimer = null;
      }, seconds * 1e3);
    }
    return true;
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

// src/overview-block.ts
var import_obsidian5 = require("obsidian");

// src/overview-data.ts
function selectOverviewEntries(fileStatuses, isSnoozed, params, allowedStatusIds) {
  const entries = Object.entries(fileStatuses).filter(([path, status]) => {
    if (isSnoozed(path)) return false;
    if (!allowedStatusIds.has(status.statusId)) return false;
    if (params.folder && !(path === params.folder || path.startsWith(params.folder + "/"))) return false;
    return true;
  });
  return sortEntries(entries, params.sort);
}
function computeOverviewStats(entries, statusConfigs) {
  var _a;
  const counts = /* @__PURE__ */ new Map();
  for (const [, status] of entries) {
    counts.set(status.statusId, ((_a = counts.get(status.statusId)) != null ? _a : 0) + 1);
  }
  return statusConfigs.filter((c) => counts.has(c.id)).map((c) => ({ config: c, count: counts.get(c.id) }));
}

// src/overview-block.ts
var OverviewBlockChild = class extends import_obsidian5.MarkdownRenderChild {
  constructor(containerEl, app, stateManager, plugin, params) {
    super(containerEl);
    this.app = app;
    this.stateManager = stateManager;
    this.plugin = plugin;
    this.params = params;
    this.refresh = () => {
      this.render();
    };
  }
  onload() {
    this.render();
    this.plugin.registerOverviewRefresh(this.refresh);
  }
  onunload() {
    this.plugin.unregisterOverviewRefresh(this.refresh);
  }
  render() {
    var _a;
    const { containerEl, stateManager, params } = this;
    containerEl.empty();
    containerEl.addClass("unread-plus-overview");
    const configs = stateManager.getStatusConfigs();
    const openConfigIds = configs.filter((c) => c.countsAsOpen).map((c) => c.id);
    const allowedStatusIds = new Set((_a = params.statusIds) != null ? _a : openConfigIds);
    const entries = selectOverviewEntries(
      stateManager.getAllFileStatuses(),
      (path) => stateManager.isSnoozed(path),
      params,
      allowedStatusIds
    );
    if (params.showStats) {
      this.renderStats(entries, configs);
    }
    if (params.showList) {
      this.renderList(entries.slice(0, params.limit));
    }
    if (entries.length === 0) {
      containerEl.createDiv({ cls: "unread-plus-overview-empty", text: "All clear \u2713" });
    }
  }
  renderStats(entries, configs) {
    const stats = computeOverviewStats(entries, configs);
    if (stats.length === 0) return;
    const statsEl = this.containerEl.createDiv({ cls: "unread-plus-overview-stats" });
    for (const { config, count } of stats) {
      const chip = statsEl.createSpan({ cls: "unread-plus-overview-chip" });
      const dot = chip.createSpan({ cls: "unread-plus-overview-dot" });
      dot.setCssStyles({ color: config.color });
      chip.createSpan({ text: ` ${count} ${config.label}` });
    }
  }
  renderList(entries) {
    if (entries.length === 0) return;
    const listEl = this.containerEl.createEl("ul", { cls: "unread-plus-overview-list" });
    for (const [path, status] of entries) {
      const config = this.stateManager.getStatusConfig(status.statusId);
      const item = listEl.createEl("li");
      const dot = item.createSpan({ cls: "unread-plus-overview-dot" });
      if (config) dot.setCssStyles({ color: config.color });
      const link = item.createEl("a", { text: path, cls: "unread-plus-overview-link" });
      link.addEventListener("click", (evt) => {
        evt.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian5.TFile) {
          void this.app.workspace.getLeaf(false).openFile(file);
        }
      });
    }
  }
};

// src/overview-params.ts
function parseOverviewParams(source, knownStatusIds) {
  const raw = {};
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    raw[key] = value;
  }
  const statusIds = raw.status ? raw.status.split(",").map((s) => s.trim()).filter((s) => knownStatusIds.includes(s)) : null;
  const folder = raw.folder ? raw.folder : null;
  const parsedLimit = raw.limit ? parseInt(raw.limit, 10) : NaN;
  const limit = !isNaN(parsedLimit) ? parsedLimit : 20;
  const sort = raw.sort === "folder" ? "folder" : raw.sort === "random" ? "random" : "created";
  const showValues = raw.show ? raw.show.split(",").map((s) => s.trim()) : ["stats", "list"];
  const showStats = showValues.includes("stats");
  const showList = showValues.includes("list");
  return { statusIds, folder, limit, sort, showStats, showList };
}

// src/onboarding-modal.ts
var import_obsidian6 = require("obsidian");
var OnboardingModal = class extends import_obsidian6.Modal {
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Welcome to Unread+" });
    contentEl.createEl("p", {
      text: "Colored dots next to file names mark their status (default: unread). Right-click a file to change or clear its status."
    });
    contentEl.createEl("p", {
      text: "Numbers next to folder names show how many files inside have an open status."
    });
    contentEl.createEl("p", {
      text: "Open Settings \u2192 Unread+ to customize statuses, colors, and behavior."
    });
    const okBtn = contentEl.createEl("button", { text: "Got it" });
    okBtn.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};

// main.ts
var _UnreadPlusPlugin = class _UnreadPlusPlugin extends import_obsidian7.Plugin {
  constructor() {
    super(...arguments);
    this.autoReadTimers = /* @__PURE__ */ new Map();
    this.recentlyRenamedPaths = /* @__PURE__ */ new Set();
    this.sessionOpenedPaths = /* @__PURE__ */ new Set();
    // Tracks files we auto-marked 'unread' via onFileCreated, keyed by the
    // markedAt timestamp we applied. If the user opens such a file later
    // (however long template prompts / manual edits take), we undo the
    // auto-mark — opening it is proof the user created it themselves.
    this.pendingAutoUnread = /* @__PURE__ */ new Map();
    this.pendingGraceChecks = /* @__PURE__ */ new Map();
    this.overviewRefreshCallbacks = /* @__PURE__ */ new Set();
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
    this.registerMarkdownCodeBlockProcessor("unread-overview", (source, el, ctx) => {
      const knownStatusIds = this.stateManager.getStatusConfigs().map((c) => c.id);
      const params = parseOverviewParams(source, knownStatusIds);
      const child = new OverviewBlockChild(el, this.app, this.stateManager, this, params);
      ctx.addChild(child);
    });
  }
  onunload() {
    this.reviewMode.stop();
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach((t) => window.clearTimeout(t));
    this.autoReadTimers.clear();
    this.pendingGraceChecks.forEach(({ timeoutId }) => window.clearTimeout(timeoutId));
    this.pendingGraceChecks.clear();
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
      if (leaf.view instanceof import_obsidian7.FileView && leaf.view.file) {
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
      this.maybeShowOnboarding();
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
  maybeShowOnboarding() {
    if (this.stateManager.hasSeenOnboarding()) return;
    this.stateManager.markOnboardingSeen();
    this.stateManager.scheduleSave();
    new OnboardingModal(this.app).open();
  }
  detectOfflineCreations() {
    this.stateManager.clearExpiredSnoozes();
    const known = this.stateManager.getKnownPaths();
    const lastClose = this.stateManager.getLastCloseTime();
    const lastOpen = this.stateManager.getLastOpenPaths();
    const currentFiles = this.app.vault.getFiles();
    const moved = this.stateManager.popMovedPaths();
    const isRecentlyMoved = (path) => moved.some((p) => path === p || path.startsWith(p + "/"));
    const currentPaths = new Set(currentFiles.map((f) => f.path));
    this.stateManager.pruneReadPaths(currentPaths);
    this.stateManager.pruneFileStatuses(currentPaths);
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
    if (!(file instanceof import_obsidian7.TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;
    if (this.wasOpenedThisSession(file.path)) return;
    if (this.stateManager.isExplicitlyRead(file.path)) return;
    if (this.isUnderRecentlyRenamedPath(file.path)) return;
    if (this.stateManager.getKnownPaths().has(file.path)) return;
    const graceMs = this.stateManager.getSettings().newFileGraceSeconds * 1e3;
    this.startGraceCheck(file.path, Date.now() + graceMs);
  }
  // Polls whether `path` becomes the active file at any point before `deadline`
  // (instead of a single point-in-time check), so a user who creates, pastes,
  // and switches away very fast is still recognized as having opened the file
  // even if Obsidian's own 'file-open' event lands later than a short fixed
  // window would allow for.
  startGraceCheck(path, deadline) {
    const existing = this.pendingGraceChecks.get(path);
    if (existing) window.clearTimeout(existing.timeoutId);
    const poll = () => {
      if (this.wasOpenedThisSession(path)) {
        this.pendingGraceChecks.delete(path);
        return;
      }
      if (Date.now() < deadline) {
        const delay = Math.min(_UnreadPlusPlugin.GRACE_POLL_INTERVAL_MS, deadline - Date.now());
        const timeoutId2 = window.setTimeout(poll, delay);
        this.pendingGraceChecks.set(path, { timeoutId: timeoutId2, deadline });
        return;
      }
      this.pendingGraceChecks.delete(path);
      if (this.stateManager.isExplicitlyRead(path)) return;
      if (this.isUnderRecentlyRenamedPath(path)) return;
      if (this.stateManager.getKnownPaths().has(path)) return;
      this.stateManager.setStatus(path, "unread");
      const applied = this.stateManager.getStatus(path);
      if (applied) this.pendingAutoUnread.set(path, applied.markedAt);
      this.stateManager.scheduleSave();
      this.refreshUI();
    };
    const initialDelay = Math.min(_UnreadPlusPlugin.GRACE_POLL_INTERVAL_MS, Math.max(deadline - Date.now(), 0));
    const timeoutId = window.setTimeout(poll, initialDelay);
    this.pendingGraceChecks.set(path, { timeoutId, deadline });
  }
  onFileRenamed(file, oldPath) {
    for (const p of [...this.sessionOpenedPaths]) {
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        this.sessionOpenedPaths.delete(p);
        this.sessionOpenedPaths.add(file.path + p.slice(oldPath.length));
      }
    }
    for (const [p, ts] of [...this.pendingAutoUnread]) {
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        this.pendingAutoUnread.delete(p);
        this.pendingAutoUnread.set(file.path + p.slice(oldPath.length), ts);
      }
    }
    for (const [p, entry] of [...this.pendingGraceChecks]) {
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        window.clearTimeout(entry.timeoutId);
        this.pendingGraceChecks.delete(p);
        this.startGraceCheck(file.path + p.slice(oldPath.length), entry.deadline);
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
  // A file counts as user-opened if it's in a leaf right now, or if it was
  // opened earlier this session (file-open fires once on creation, but a
  // template-insertion plugin can briefly swap the leaf away from a FileView
  // afterwards — that shouldn't make an already-opened note look unread).
  wasOpenedThisSession(filePath) {
    return this.getOpenFilePaths().has(filePath) || this.sessionOpenedPaths.has(filePath);
  }
  isUnderRecentlyRenamedPath(filePath) {
    for (const p of this.recentlyRenamedPaths) {
      if (filePath === p || filePath.startsWith(p + "/")) return true;
    }
    return false;
  }
  onFileDeleted(file) {
    this.stateManager.deletePath(file.path);
    for (const p of [...this.pendingAutoUnread.keys()]) {
      if (p === file.path || p.startsWith(file.path + "/")) this.pendingAutoUnread.delete(p);
    }
    for (const [p, entry] of [...this.pendingGraceChecks]) {
      if (p === file.path || p.startsWith(file.path + "/")) {
        window.clearTimeout(entry.timeoutId);
        this.pendingGraceChecks.delete(p);
      }
    }
    this.stateManager.scheduleSave();
    this.refreshUI();
  }
  onFileOpen(file) {
    if (!file) return;
    this.sessionOpenedPaths.add(file.path);
    const autoMarkedAt = this.pendingAutoUnread.get(file.path);
    if (autoMarkedAt !== void 0) {
      this.pendingAutoUnread.delete(file.path);
      const status = this.stateManager.getStatus(file.path);
      if ((status == null ? void 0 : status.statusId) === "unread" && status.markedAt === autoMarkedAt) {
        this.stateManager.clearStatus(file.path);
        this.stateManager.scheduleSave();
        this.refreshUI();
      }
    }
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
  setFilesStatus(files, statusId) {
    for (const file of files) {
      this.stateManager.setStatus(file.path, statusId);
    }
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
  clearFilesStatus(files) {
    for (const file of files) {
      this.stateManager.clearStatus(file.path);
    }
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
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "U" }],
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
      id: "previous-review",
      name: "Previous in review",
      checkCallback: (checking) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) void this.reviewMode.previous(this.app, this.stateManager, this);
        return true;
      }
    });
  }
  registerOverviewRefresh(cb) {
    this.overviewRefreshCallbacks.add(cb);
  }
  unregisterOverviewRefresh(cb) {
    this.overviewRefreshCallbacks.delete(cb);
  }
  refreshUI() {
    this.badgeRenderer.refresh();
    this.updateStatusBar();
    this.overviewRefreshCallbacks.forEach((cb) => cb());
  }
  updateStatusBar() {
    var _a;
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
      span.textContent = `${count}${(_a = config.icon) != null ? _a : "\u25CF"}`;
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
      this.app.workspace.on("files-menu", (menu, files) => {
        const selectedFiles = files.filter(
          (file) => file instanceof import_obsidian7.TFile && !this.stateManager.isIgnored(file.path)
        );
        if (selectedFiles.length === 0) return;
        const unreadConfig = this.stateManager.getStatusConfig("unread");
        menu.addSeparator();
        if (unreadConfig) {
          menu.addItem((item) => {
            const frag = activeDocument.createDocumentFragment();
            frag.appendChild(this.makeMenuDot(unreadConfig.color));
            frag.appendChild(activeDocument.createTextNode("Mark selected as Unread"));
            item.setTitle(frag).onClick(() => this.setFilesStatus(selectedFiles, unreadConfig.id));
          });
        }
        menu.addItem((item) => {
          const frag = activeDocument.createDocumentFragment();
          if (unreadConfig) frag.appendChild(this.makeMenuDot(unreadConfig.color, "\u25CB"));
          frag.appendChild(activeDocument.createTextNode("Mark selected as read"));
          item.setTitle(frag).onClick(() => this.clearFilesStatus(selectedFiles));
        });
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian7.TFile)) return;
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
_UnreadPlusPlugin.GRACE_POLL_INTERVAL_MS = 100;
var UnreadPlusPlugin = _UnreadPlusPlugin;
