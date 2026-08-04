import { Modal } from 'obsidian';

const STEPS: { icon: string; text: string }[] = [
  { icon: '●', text: 'Colored dots next to file names mark their status (default: unread). Right-click a file to change or clear it.' },
  { icon: '📁', text: 'Numbers next to folder names show how many files inside have an open status.' },
  { icon: '⚙️', text: 'Head to Settings → Unread+ to customize statuses, colors, and behavior.' },
];

export class OnboardingModal extends Modal {
  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('unread-plus-onboarding');

    contentEl.createEl('h2', { text: '👋 Welcome to Unread+' });
    contentEl.createEl('p', {
      cls: 'unread-plus-onboarding-intro',
      text: "Here's the quick version:",
    });

    const list = contentEl.createEl('ul', { cls: 'unread-plus-onboarding-list' });
    for (const step of STEPS) {
      const item = list.createEl('li');
      item.createSpan({ cls: 'unread-plus-onboarding-icon', text: step.icon });
      item.createSpan({ text: step.text });
    }

    contentEl.createEl('p', {
      cls: 'unread-plus-onboarding-outro',
      text: "That's it, you're all set :)",
    });

    const okBtn = contentEl.createEl('button', { cls: 'mod-cta', text: 'Got it' });
    okBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
