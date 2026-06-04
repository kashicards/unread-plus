# Unread+

An Obsidian plugin that marks new files with a colored dot and propagates unread counts up the entire folder tree — so you never miss what's new, even in a collapsed vault.

![File explorer with dots and folder badge](docs/preview-explorer.png)

---

## Features

**Colored dots on files** — every new file gets a dot. Blue = Unread, Orange = Later. Colors and labels are fully customizable.

**Folder badges with per-status counts** — the count propagates up the entire folder tree. If you have 1 unread and 1 later somewhere inside a folder, you see `1● 1●` with the right colors — at any depth, even collapsed.

**Offline detection** — files created by scripts, sync tools (iCloud, Dropbox, Obsidian Sync), or anything else while Obsidian was closed are automatically picked up on the next launch.

**Colored context menu** — right-click any file to set or clear its status. Each option shows a colored circle so you know exactly what you're picking.

![Right-click context menu with colored circles](docs/preview-context-menu.png)

**Open Next Unread** — press `Ctrl+Shift+U` (Mac: `Cmd+Shift+U`) to open all unread files one by one. Hit it again for the next. When the queue is empty you get an "All clear ✓" notice.

---

## Installation

> Not yet in the community plugin list. Install manually:

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](../../releases/latest)
2. Copy to `.obsidian/plugins/unread-plus/` in your vault
3. Obsidian → Settings → Community Plugins → enable **Unread+**

**From source:**
```bash
git clone https://github.com/kashicards/unread-plus.git
cd unread-plus
npm install && npm run build
```

---

## Usage

| What | How |
|------|-----|
| Mark a file unread or later | Right-click the file → pick status |
| Clear a file's status | Right-click → Mark as read |
| Open next unread file | `Ctrl+Shift+U` |
| Mark all as read | Command palette → *Mark all as read* |
| Mark current file as unread | Command palette → *Mark current file as unread* |
| Clear all in current folder | Command palette → *Mark all in current folder as read* |

---

## Settings

![Settings page](docs/preview-settings.png)

**General**
- **Auto-read delay** — auto-clear status after N seconds of the file being open (0 = off)
- **Show label in badge** — show `Unread ●` instead of just `●`

**Ignore**
- **Ignored paths** — folder prefixes never tracked (e.g. `Templates`, `Archive`)
- **Ignored extensions** — file types to skip (default: `json`)

**Statuses**
- Add, rename, recolor statuses freely
- **Counts as open** — whether this status shows up in folder badges and the `Ctrl+Shift+U` queue

**Queue (Ctrl+Shift+U)**
- Order: oldest first / by folder / random
- Auto-mark as read after N seconds in queue (0 = off)

---

## How offline detection works

On startup, the plugin compares the current vault against a snapshot from the last session. Any file that is new or was modified after Obsidian last closed gets marked unread automatically. This covers scripts, sync tools, and anything else that writes to your vault while Obsidian is closed.
