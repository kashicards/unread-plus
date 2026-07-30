import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewMode } from '../src/review-mode';
import { StateManager } from '../src/state-manager';

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
