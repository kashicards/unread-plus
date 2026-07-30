import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
  constructor(app: App, private message: string, private onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('p', { text: this.message });
    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn =>
        btn
          .setButtonText('Confirm')
          .setWarning()
          .onClick(() => {
            this.onConfirm();
            this.close();
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
