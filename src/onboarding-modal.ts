import { Modal } from 'obsidian';

export class OnboardingModal extends Modal {
  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Welcome to Unread+' });
    contentEl.createEl('p', {
      text: 'Colored dots next to file names mark their status (default: unread). Right-click a file to change or clear its status.',
    });
    contentEl.createEl('p', {
      text: 'Numbers next to folder names show how many files inside have an open status.',
    });
    contentEl.createEl('p', {
      text: 'Open Settings → Unread+ to customize statuses, colors, and behavior.',
    });

    const okBtn = contentEl.createEl('button', { text: 'Got it' });
    okBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
