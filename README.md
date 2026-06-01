# Unread+

An Obsidian plugin that marks newly created files with a status dot — and propagates unread counts up the entire folder tree.

## The Problem

Every existing unread plugin marks only the file itself. If your vault is collapsed and a script drops new files deep in subfolders, you see nothing. You have to manually expand every folder to find what's new.

```
❌ What other plugins show (vault collapsed):
📁 Research
📁 Design
📁 Archive

✅ What Unread+ shows:
📁 Research    (5)   ← 5 unread somewhere inside
📁 Design      (2)
📁 Archive
```

## Features

### Automatic Dot on New Files

Every file created inside your vault — whether manually in Obsidian or by an external script — gets a colored dot in the file explorer.

### Folder Badge with Count

The unread count propagates upward through the entire folder tree. A folder badge shows how many unread files are somewhere inside, at any depth. The badge color reflects the dominant status in that folder.

### Status System

Instead of just read/unread, you can define custom statuses — each with a name, color, and whether it counts as "open" (appears in folder badge counts).

**Default statuses:**

| Status | Color | Counts as open |
|--------|-------|---------------|
| Unread | Orange `#FA6300` | ✅ |
| Skip   | Grey `#888888`   | ❌ |
| Review | Blue `#2066DF`   | ✅ |

### Right-Click Context Menu

Right-click any file in the file explorer to set its status:

- **Mark as Unread** — orange dot
- **Mark as Review** — blue dot
- **Mark as Skip** — grey dot, does not count toward folder badge
- **Mark as read** — removes dot entirely

### Commands

Open the command palette (`Ctrl+P` / `Cmd+P`) and search for:

| Command | What it does |
|---------|-------------|
| `Unread+: Mark all as read` | Clears all dots and badges across the entire vault |
| `Unread+: Mark current file as unread` | Marks the active file as unread |
| `Unread+: Mark all in current folder as read` | Clears all files in the active file's folder |
| `Unread+: Start review` | Opens the first file in your review queue |
| `Unread+: Next in review` | Advances to the next file in the queue |

### Review Mode

Work through all your open files one by one without touching the sidebar.

1. Run **Start review** — opens the first unread/review file
2. Read it, then run **Next in review** — next file opens
3. Continue until you see **"Unread+: All clear ✓"**

### Rename and Move

Status follows files. Rename a file or move it to another folder — the dot stays on it and folder badges update automatically.

### Auto-Read Timer

Optionally mark a file as read automatically after you've had it open for N seconds. Set to `0` to disable.

### Ignore Lists

Prevent certain folders or file types from ever being marked unread:

- **Ignored paths** — prefix match, e.g. `Templates` ignores everything under `Templates/`
- **Ignored extensions** — e.g. `pdf, png` so attachments are never marked

---

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases)
2. Create the folder `.obsidian/plugins/unread-plus/` in your vault
3. Copy the three files into that folder
4. In Obsidian: **Settings → Community plugins → Unread+** → toggle on

### From Source

```bash
git clone https://github.com/kashicards/unread-plus.git
cd unread-plus
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/unread-plus/` in your vault.

---

## Settings

Open **Settings → Unread+** to configure:

### General

- **Auto-read delay (seconds)** — automatically mark a file as read after it's been open this long. `0` = disabled.
- **Show status label in badge** — display `● Unread` instead of just `●` next to file names.

### Ignore

- **Ignored paths** — one path prefix per line. Files under these paths are never marked unread.
- **Ignored extensions** — comma-separated, without dots (e.g. `pdf, png, jpg`).

### Statuses

Add, rename, recolor, or delete statuses. For each status:

- **Color** — shown as the dot color on files and the badge color on folders
- **Label** — appears in the right-click menu and optionally in the badge
- **Counts as open** — if checked, this status contributes to folder badge counts

### Review Mode

- **Enable Review Mode** — shows/hides the Start Review and Next in Review commands
- **Review order** — By creation date / By folder / Random
- **Auto-mark read in review** — automatically clear status after N seconds in review. `0` = disabled.
- **Statuses included in review** — comma-separated status IDs (e.g. `unread, review`)

---

## Known Limitation

The DOM injection uses Obsidian's `[data-path]` attributes on file explorer elements, which is stable public API. Folder badge injection relies on `.nav-folder-title` and `.nav-file-title` CSS selectors — these have been stable across Obsidian versions but could theoretically change in a major update.
