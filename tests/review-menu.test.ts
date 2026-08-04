import { describe, it, expect, vi } from 'vitest';
import { buildReviewMenuItems } from '../src/review-menu';

describe('buildReviewMenuItems', () => {
  it('includes Next and Restart but not Previous when review is not active', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: false, onNext, onPrevious, onRestart });

    expect(items.map(i => i.title)).toEqual(['Next unread', 'Restart queue from beginning']);
  });

  it('includes Next, Previous and Restart when review is active', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: true, onNext, onPrevious, onRestart });

    expect(items.map(i => i.title)).toEqual(['Next unread', 'Previous in review', 'Restart queue from beginning']);
  });

  it('wires each item onClick to its callback', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: true, onNext, onPrevious, onRestart });
    items.find(i => i.title === 'Next unread')!.onClick();
    items.find(i => i.title === 'Previous in review')!.onClick();
    items.find(i => i.title === 'Restart queue from beginning')!.onClick();

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
