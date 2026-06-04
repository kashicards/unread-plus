import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type UnreadPlusPlugin from '../main';

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
    el.createEl('h2', { text: 'Queue (Ctrl+Shift+U)' });
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
}
