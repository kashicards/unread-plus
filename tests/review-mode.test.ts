import { describe, it, expect, beforeEach } from 'vitest';
import { Notice, TFile } from 'obsidian';
import { ReviewMode } from '../src/review-mode';
import { StateManager } from '../src/state-manager';

function makeApp(openFile: (file: TFile) => Promise<void>) {
  return {
    vault: {
      getAbstractFileByPath: (path: string) => {
        const file = new TFile();
        file.path = path;
        return file;
      },
    },
    workspace: {
      getLeaf: () => ({ openFile }),
    },
  } as any;
}

function makeManager(): StateManager {
  const mockPlugin = { loadData: async () => null, saveData: async () => {} } as any;
  return new StateManager(mockPlugin);
}

describe('ReviewMode.start', () => {
  let sm: StateManager;
  let review: ReviewMode;

  beforeEach(async () => {
    sm = makeManager();
    await sm.load();
    review = new ReviewMode();
  });

  it('is inactive with an empty queue when there is nothing to review', () => {
    review.start(sm);
    expect(review.isActive()).toBe(false);
  });

  it('queues only statuses whose config has countsAsOpen: true', () => {
    sm.setStatus('a.md', 'unread');
    sm.updateStatusConfigs([
      { id: 'unread', label: 'Unread', color: '#000', countsAsOpen: true },
      { id: 'skip', label: 'Skip', color: '#111', countsAsOpen: false },
    ]);
    sm.setStatus('b.md', 'skip');

    review.start(sm);

    expect(review.isActive()).toBe(true);
  });

  it('orders the queue oldest-first for reviewOrder: created', () => {
    sm.updateSettings({ reviewOrder: 'created' });
    sm.setStatus('b.md', 'unread');
    sm.setStatus('a.md', 'unread');

    review.start(sm);

    expect((review as any).queue).toEqual(['b.md', 'a.md']);
  });

  it('orders the queue by path for reviewOrder: folder', () => {
    sm.updateSettings({ reviewOrder: 'folder' });
    sm.setStatus('z.md', 'unread');
    sm.setStatus('a.md', 'unread');

    review.start(sm);

    expect((review as any).queue).toEqual(['a.md', 'z.md']);
  });
});

describe('ReviewMode.next', () => {
  let sm: StateManager;
  let review: ReviewMode;

  beforeEach(async () => {
    sm = makeManager();
    await sm.load();
    review = new ReviewMode();
    (Notice as any).lastMessage = null;
  });

  it('shows a "N von M" progress Notice when opening a file', async () => {
    sm.updateSettings({ reviewOrder: 'created' });
    sm.setStatus('a.md', 'unread');
    sm.setStatus('b.md', 'unread');
    review.start(sm);

    const app = makeApp(async () => {});
    await review.next(app, sm, {} as any);

    expect((Notice as any).lastMessage).toBe('Unread+: 1 von 2');

    await review.next(app, sm, {} as any);

    expect((Notice as any).lastMessage).toBe('Unread+: 2 von 2');
  });
});
