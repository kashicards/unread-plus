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
  reviewOrder: "created",
  reviewAutoMarkSeconds: 0
};
var DEFAULT_DATA = {
  version: 4,
  fileStatuses: {},
  statusConfigs: DEFAULT_STATUS_CONFIGS,
  settings: DEFAULT_SETTINGS,
  knownPaths: [],
  lastCloseTime: 0
};

// src/state-manager.ts
var StateManager = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.data = structuredClone(DEFAULT_DATA);
  }
  async load() {
    var _a, _b, _c, _d;
    const saved = await this.plugin.loadData();
    if (!saved) return;
    this.data = {
      ...DEFAULT_DATA,
      ...saved,
      settings: { ...DEFAULT_DATA.settings, ...saved.settings },
      statusConfigs: (_a = saved.statusConfigs) != null ? _a : DEFAULT_DATA.statusConfigs,
      fileStatuses: (_b = saved.fileStatuses) != null ? _b : {},
      knownPaths: (_c = saved.knownPaths) != null ? _c : [],
      lastCloseTime: (_d = saved.lastCloseTime) != null ? _d : 0
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
  async save() {
    await this.plugin.saveData(this.data);
  }
  // --- File status ---
  setStatus(path, statusId) {
    this.data.fileStatuses[path] = { statusId, markedAt: Date.now() };
  }
  clearStatus(path) {
    delete this.data.fileStatuses[path];
  }
  getStatus(path) {
    return this.data.fileStatuses[path];
  }
  getAllFileStatuses() {
    return { ...this.data.fileStatuses };
  }
  hasOpenStatus(path) {
    var _a, _b;
    const status = this.getStatus(path);
    if (!status) return false;
    return (_b = (_a = this.getStatusConfig(status.statusId)) == null ? void 0 : _a.countsAsOpen) != null ? _b : false;
  }
  renamePath(oldPath, newPath) {
    const entries = Object.entries(this.data.fileStatuses);
    for (const [path, status] of entries) {
      if (path === oldPath || path.startsWith(oldPath + "/")) {
        const updated = newPath + path.slice(oldPath.length);
        delete this.data.fileStatuses[path];
        this.data.fileStatuses[updated] = status;
      }
    }
  }
  deletePath(path) {
    for (const key of Object.keys(this.data.fileStatuses)) {
      if (key === path || key.startsWith(path + "/")) {
        delete this.data.fileStatuses[key];
      }
    }
  }
  clearAll() {
    this.data.fileStatuses = {};
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
  tryAttachObserver() {
    if (!this.observer) this.attachObserver();
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
    const leaves = this.app.workspace.getLeavesOfType("file-explorer");
    return leaves.length > 0 ? leaves[0].view.containerEl : null;
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
      const config = configMap.get(status.statusId);
      if (!config) return;
      const dot = document.createElement("span");
      dot.className = "unread-plus-dot";
      dot.setAttribute("data-status", status.statusId);
      dot.style.setProperty("--dot-color", config.color);
      if (settings.badgeShowLabel) {
        dot.setAttribute("data-label", config.label);
      }
      titleEl.appendChild(dot);
    });
  }
  renderFolderBadges(container) {
    const folderCounts = computeFolderCounts(
      this.stateManager.getAllFileStatuses(),
      this.stateManager.getStatusConfigs()
    );
    container.querySelectorAll(".nav-folder-title[data-path]").forEach((titleEl) => {
      const path = titleEl.getAttribute("data-path");
      if (!path) return;
      const count = folderCounts.get(path);
      if (!count || count.segments.length === 0) return;
      const badge = document.createElement("span");
      badge.className = "unread-plus-folder-badge";
      for (const seg of count.segments) {
        const span = document.createElement("span");
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
        const isOwnNode = (n) => n instanceof Element && (n.classList.contains("unread-plus-dot") || n.classList.contains("unread-plus-folder-badge"));
        return Array.from(m.addedNodes).every(isOwnNode) && Array.from(m.removedNodes).every(isOwnNode);
      });
      if (isOwnChange) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.refresh(), 50);
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
    el.createEl("h2", { text: "General" });
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
  }
  renderIgnoreSection(el) {
    el.createEl("h2", { text: "Ignore" });
    new import_obsidian.Setting(el).setName("Ignored paths").setDesc('One path prefix per line (e.g. "Templates" or "Archive/old"). Files under these paths are never marked unread.').addTextArea((text) => {
      text.setValue(this.plugin.stateManager.getSettings().ignorePaths.join("\n")).onChange(async (value) => {
        const paths = value.split("\n").map((s) => s.trim()).filter(Boolean);
        this.plugin.stateManager.updateSettings({ ignorePaths: paths });
        await this.plugin.stateManager.save();
      });
      text.inputEl.rows = 4;
      text.inputEl.style.width = "100%";
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
    el.createEl("h2", { text: "Statuses" });
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
      colorInput.addEventListener("change", async () => {
        configs[i] = { ...configs[i], color: colorInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
      const labelInput = row.createEl("input", { type: "text" });
      labelInput.value = config.label;
      labelInput.placeholder = "Label";
      labelInput.addEventListener("change", async () => {
        configs[i] = { ...configs[i], label: labelInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
      });
      const toggleLabel = row.createEl("label", { cls: "unread-plus-toggle-label" });
      const toggleInput = toggleLabel.createEl("input", { type: "checkbox" });
      toggleInput.checked = config.countsAsOpen;
      toggleLabel.createSpan({ text: " Counts as open" });
      toggleInput.addEventListener("change", async () => {
        configs[i] = { ...configs[i], countsAsOpen: toggleInput.checked };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        await this.plugin.stateManager.save();
        this.plugin.badgeRenderer.refresh();
      });
      const deleteBtn = row.createEl("button", { text: "\u2715" });
      deleteBtn.addEventListener("click", async () => {
        if (configs.length <= 1) {
          new import_obsidian.Notice("At least one status is required.");
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
  renderReviewSection(el) {
    el.createEl("h2", { text: "Queue (Ctrl+Shift+U)" });
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
        if (this.autoMarkTimer !== null) clearTimeout(this.autoMarkTimer);
        this.autoMarkTimer = setTimeout(() => {
          plugin.clearFileStatus(path);
          this.autoMarkTimer = null;
        }, seconds * 1e3);
      }
      return;
    }
  }
  stop() {
    if (this.autoMarkTimer !== null) {
      clearTimeout(this.autoMarkTimer);
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
    this.isLayoutReady = false;
  }
  async onload() {
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
  async onunload() {
    this.reviewMode.stop();
    this.badgeRenderer.stop();
    this.autoReadTimers.forEach((t) => clearTimeout(t));
    this.autoReadTimers.clear();
    this.stateManager.setKnownPaths(this.app.vault.getFiles().map((f) => f.path));
    this.stateManager.setLastCloseTime(Date.now());
    await this.stateManager.save();
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
      this.app.workspace.on("layout-change", () => {
        this.badgeRenderer.tryAttachObserver();
        this.badgeRenderer.refresh();
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => this.onFileOpen(file))
    );
  }
  detectOfflineCreations() {
    const known = this.stateManager.getKnownPaths();
    const lastClose = this.stateManager.getLastCloseTime();
    const currentFiles = this.app.vault.getFiles();
    console.log(`[Unread+] detectOfflineCreations: known=${known.size} lastClose=${lastClose} current=${currentFiles.length}`);
    const hasBaseline = known.size > 0 || lastClose > 0;
    if (hasBaseline) {
      for (const file of currentFiles) {
        if (this.stateManager.isIgnored(file.path)) continue;
        if (this.stateManager.getStatus(file.path)) continue;
        const isNewPath = known.size > 0 && !known.has(file.path);
        const isModifiedOffline = lastClose > 0 && file.stat.mtime > lastClose;
        if (isNewPath || isModifiedOffline) {
          console.log(`[Unread+] Offline change: ${file.path} (new=${isNewPath} modified=${isModifiedOffline})`);
          this.stateManager.setStatus(file.path, "unread");
        }
      }
    } else {
      console.log("[Unread+] No baseline yet \u2014 skipping offline detection");
    }
    if (currentFiles.length > 0) {
      this.stateManager.setKnownPaths(currentFiles.map((f) => f.path));
      this.stateManager.save();
    }
    setTimeout(() => this.badgeRenderer.refresh(), 150);
  }
  onFileCreated(file) {
    if (!(file instanceof import_obsidian3.TFile)) return;
    if (this.stateManager.isIgnored(file.path)) return;
    this.stateManager.setStatus(file.path, "unread");
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }
  onFileRenamed(file, oldPath) {
    this.stateManager.renamePath(oldPath, file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }
  onFileDeleted(file) {
    this.stateManager.deletePath(file.path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }
  onFileOpen(file) {
    if (!file) return;
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
    }, seconds * 1e3);
    this.autoReadTimers.set(file.path, timer);
  }
  // Called by context menu and commands
  setFileStatus(path, statusId) {
    this.stateManager.setStatus(path, statusId);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }
  clearFileStatus(path) {
    this.stateManager.clearStatus(path);
    this.stateManager.save();
    this.badgeRenderer.refresh();
  }
  registerCommands() {
    this.addCommand({
      id: "mark-all-read",
      name: "Mark all as read",
      callback: () => {
        this.stateManager.clearAll();
        this.stateManager.save();
        this.badgeRenderer.refresh();
      }
    });
    this.addCommand({
      id: "mark-current-unread",
      name: "Mark current file as unread",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.setFileStatus(file.path, "unread");
        }
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
          const statuses = this.stateManager.getAllFileStatuses();
          for (const path of Object.keys(statuses)) {
            const inFolder = folder === "" ? !path.includes("/") : path.startsWith(folder + "/");
            if (inFolder) {
              this.stateManager.clearStatus(path);
            }
          }
          this.stateManager.save();
          this.badgeRenderer.refresh();
        }
        return true;
      }
    });
    this.addCommand({
      id: "open-next-unread",
      name: "Open next unread",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "U" }],
      callback: () => {
        if (!this.reviewMode.isActive()) {
          this.reviewMode.start(this.stateManager);
        }
        this.reviewMode.next(this.app, this.stateManager, this);
      }
    });
    this.addCommand({
      id: "start-review",
      name: "Restart queue from beginning",
      callback: () => {
        this.reviewMode.start(this.stateManager);
        this.reviewMode.next(this.app, this.stateManager, this);
      }
    });
    this.addCommand({
      id: "next-review",
      name: "Next in review",
      checkCallback: (checking) => {
        if (!this.reviewMode.isActive()) return false;
        if (!checking) {
          this.reviewMode.next(this.app, this.stateManager, this);
        }
        return true;
      }
    });
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
            const frag = document.createDocumentFragment();
            const dot = document.createElement("span");
            dot.textContent = "\u25CF ";
            dot.style.cssText = `color:${config.color};font-size:10px;margin-right:2px;`;
            frag.appendChild(dot);
            frag.appendChild(document.createTextNode(config.label));
            item.setTitle(frag).onClick(() => this.setFileStatus(file.path, config.id));
          });
        }
        if (current) {
          const currentConfig = configs.find((c) => c.id === current.statusId);
          menu.addItem((item) => {
            const frag = document.createDocumentFragment();
            if (currentConfig) {
              const dot = document.createElement("span");
              dot.textContent = "\u25CB ";
              dot.style.cssText = `color:${currentConfig.color};font-size:10px;margin-right:2px;`;
              frag.appendChild(dot);
            }
            frag.appendChild(document.createTextNode("Mark as read"));
            item.setTitle(frag).onClick(() => this.clearFileStatus(file.path));
          });
        }
      })
    );
  }
};
