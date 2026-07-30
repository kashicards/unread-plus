import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type UnreadPlusPlugin from '../main';
import { ConfirmModal } from './confirm-modal';
import { DEFAULT_SETTINGS, DEFAULT_STATUS_CONFIGS } from './types';
import { formatRemaining } from './format-duration';
import { FolderSuggest } from './folder-suggest';

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
    this.renderSnoozeSection(containerEl);
    this.renderResetSection(containerEl);
  }

  private renderGeneralSection(el: HTMLElement): void {

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
      .setName('New file grace period (seconds)')
      .setDesc('How long after creating a file to watch whether it becomes the active file, before marking it unread. Increase if you see false unread marks when creating and leaving files very quickly. Max 10.')
      .addText(text => {
        text
          .setValue(String(this.plugin.stateManager.getSettings().newFileGraceSeconds))
          .onChange(async value => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0 && n <= 10) {
              this.plugin.stateManager.updateSettings({ newFileGraceSeconds: n });
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

    new Setting(el)
      .setName('Dot aging')
      .setDesc('Dots start at full opacity and fade slightly each day. Keeps old unread files visually subtle.')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.stateManager.getSettings().dotAging)
          .onChange(async value => {
            this.plugin.stateManager.updateSettings({ dotAging: value });
            await this.plugin.stateManager.save();
            this.plugin.badgeRenderer.refresh();
          });
      });
  }

  private renderIgnoreSection(el: HTMLElement): void {
    new Setting(el).setName('Ignore').setHeading();

    new Setting(el)
      .setName('Ignored paths')
      .setDesc('Files under these folders are never marked unread. Type to search vault folders, then pick a suggestion or press Enter to add.')
      .addText(text => {
        text.setPlaceholder('Search folders…');
        const suggest = new FolderSuggest(this.app, text.inputEl);
        suggest.onSelect(folder => {
          this.addIgnoredPath(folder.path);
          text.setValue('');
        });
        text.inputEl.addEventListener('keydown', evt => {
          if (evt.key !== 'Enter') return;
          evt.preventDefault();
          const value = text.getValue().trim();
          if (value) {
            this.addIgnoredPath(value);
            text.setValue('');
          }
        });
      });

    const ignorePathListEl = el.createDiv({ cls: 'unread-plus-ignore-path-list' });
    for (const path of this.plugin.stateManager.getSettings().ignorePaths) {
      const row = ignorePathListEl.createDiv({ cls: 'unread-plus-ignore-path-row' });
      row.createSpan({ text: path });
      const removeBtn = row.createEl('button', { text: '✕' });
      removeBtn.addEventListener('click', () => this.removeIgnoredPath(path));
    }

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

  private addIgnoredPath(path: string): void {
    const current = this.plugin.stateManager.getSettings().ignorePaths;
    if (current.includes(path)) return;
    this.plugin.stateManager.updateSettings({ ignorePaths: [...current, path] });
    this.plugin.stateManager.save().catch(() => {});
    this.display();
  }

  private removeIgnoredPath(path: string): void {
    const updated = this.plugin.stateManager.getSettings().ignorePaths.filter(p => p !== path);
    this.plugin.stateManager.updateSettings({ ignorePaths: updated });
    this.plugin.stateManager.save().catch(() => {});
    this.display();
  }

  private renderStatusSection(el: HTMLElement): void {
    new Setting(el).setName('Statuses').setHeading();
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

      // Drag handle for reordering
      const handle = row.createSpan({ cls: 'unread-plus-drag-handle', text: '⠿' });
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', evt => {
        evt.dataTransfer?.setData('text/plain', String(i));
        row.addClass('unread-plus-dragging');
      });
      handle.addEventListener('dragend', () => {
        row.removeClass('unread-plus-dragging');
      });
      row.addEventListener('dragover', evt => {
        evt.preventDefault();
      });
      row.addEventListener('drop', evt => {
        evt.preventDefault();
        const fromIndex = Number(evt.dataTransfer?.getData('text/plain'));
        if (isNaN(fromIndex) || fromIndex === i) return;
        const [moved] = configs.splice(fromIndex, 1);
        configs.splice(i, 0, moved);
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {});
        this.plugin.badgeRenderer.refresh();
        listEl.empty();
        this.renderStatusList(listEl);
      });

      // Color picker
      const colorInput = row.createEl('input', { type: 'color' });
      colorInput.value = config.color;
      colorInput.addEventListener('change', () => {
        configs[i] = { ...configs[i], color: colorInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {});
        this.plugin.badgeRenderer.refresh();
      });

      // Label input
      const labelInput = row.createEl('input', { type: 'text' });
      labelInput.value = config.label;
      labelInput.placeholder = 'Label';
      labelInput.addEventListener('change', () => {
        configs[i] = { ...configs[i], label: labelInput.value };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {});
      });

      // Icon input (free text/emoji, optional — falls back to the color dot)
      const iconInput = row.createEl('input', { type: 'text', cls: 'unread-plus-icon-input' });
      iconInput.value = config.icon ?? '';
      iconInput.placeholder = '●';
      iconInput.maxLength = 4;
      iconInput.addEventListener('change', () => {
        const icon = iconInput.value.trim();
        configs[i] = { ...configs[i], icon: icon || undefined };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {});
        this.plugin.badgeRenderer.refresh();
      });

      // Counts as open toggle
      const toggleLabel = row.createEl('label', { cls: 'unread-plus-toggle-label' });
      const toggleInput = toggleLabel.createEl('input', { type: 'checkbox' });
      toggleInput.checked = config.countsAsOpen;
      toggleLabel.createSpan({ text: ' Counts as open' });
      toggleInput.addEventListener('change', () => {
        configs[i] = { ...configs[i], countsAsOpen: toggleInput.checked };
        this.plugin.stateManager.updateStatusConfigs([...configs]);
        this.plugin.stateManager.save().catch(() => {});
        this.plugin.badgeRenderer.refresh();
      });

      // Delete button (prevent deleting last status)
      const deleteBtn = row.createEl('button', { text: '✕' });
      deleteBtn.addEventListener('click', () => {
        if (configs.length <= 1) {
          new Notice('At least one status is required.');
          return;
        }

        const affectedPaths = Object.entries(this.plugin.stateManager.getAllFileStatuses())
          .filter(([, status]) => status.statusId === config.id)
          .map(([path]) => path);

        const message = affectedPaths.length > 0
          ? `Delete status "${config.label}"? ${affectedPaths.length} file(s) currently have this status and will be marked as read.`
          : `Delete status "${config.label}"?`;

        new ConfirmModal(this.app, message, () => {
          for (const path of affectedPaths) {
            this.plugin.stateManager.clearStatus(path);
          }
          configs.splice(i, 1);
          this.plugin.stateManager.updateStatusConfigs([...configs]);
          this.plugin.stateManager.save().catch(() => {});
          this.plugin.badgeRenderer.refresh();
          listEl.empty();
          this.renderStatusList(listEl);
        }).open();
      });
    }
  }

  private renderReviewSection(el: HTMLElement): void {
    new Setting(el).setName('Queue (Ctrl+Shift+U)').setHeading();
    el.createEl('p', {
      text: 'Opens all files with a status (Unread, Later, …) one by one. "Counts as open" on each status controls which ones appear here.',
      cls: 'setting-item-description',
    });

    new Setting(el)
      .setName('Queue order')
      .addDropdown(drop => {
        drop
          .addOption('created', 'Oldest first')
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
      .setName('Auto-mark as read (seconds)')
      .setDesc('Auto-clear status after this many seconds of the file being open. 0 = off.')
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
  }

  private renderSnoozeSection(el: HTMLElement): void {
    new Setting(el).setName('Snoozed files').setHeading();

    const now = Date.now();
    const snoozed = Object.entries(this.plugin.stateManager.getAllFileStatuses())
      .filter((entry): entry is [string, typeof entry[1] & { snoozedUntil: number }] =>
        !!entry[1].snoozedUntil && entry[1].snoozedUntil > now
      )
      .sort((a, b) => a[1].snoozedUntil - b[1].snoozedUntil);

    if (snoozed.length === 0) {
      el.createEl('p', {
        text: 'No files are currently snoozed.',
        cls: 'setting-item-description',
      });
      return;
    }

    for (const [path, status] of snoozed) {
      new Setting(el)
        .setName(path)
        .setDesc(`Wakes up in ${formatRemaining(status.snoozedUntil - now)}`)
        .addButton(btn =>
          btn.setButtonText('Unsnooze').onClick(async () => {
            this.plugin.stateManager.clearSnooze(path);
            await this.plugin.stateManager.save();
            this.plugin.badgeRenderer.refresh();
            this.display();
          })
        );
    }
  }

  private renderResetSection(el: HTMLElement): void {
    new Setting(el).setName('Danger zone').setHeading();

    new Setting(el)
      .setName('Reset to defaults')
      .setDesc('Resets all settings and statuses back to their defaults. This cannot be undone.')
      .addButton(btn =>
        btn
          .setButtonText('Reset to defaults')
          .setWarning()
          .onClick(() => {
            new ConfirmModal(
              this.app,
              'This will reset all settings and statuses to their defaults. Continue?',
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
}
