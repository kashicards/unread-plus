import { describe, it, expect, vi } from 'vitest';
import { buildReviewMenuItems } from '../src/review-menu';

describe('buildReviewMenuItems', () => {
  it('includes Restart but not Previous when review is not active', () => {
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: false, onPrevious, onRestart });

    expect(items.map(i => i.title)).toEqual(['Restart queue from beginning']);
  });

  it('includes both Previous and Restart when review is active', () => {
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: true, onPrevious, onRestart });

    expect(items.map(i => i.title)).toEqual(['Previous in review', 'Restart queue from beginning']);
  });

  it('wires each item onClick to its callback', () => {
    const onPrevious = vi.fn();
    const onRestart = vi.fn();

    const items = buildReviewMenuItems({ isReviewActive: true, onPrevious, onRestart });
    items.find(i => i.title === 'Previous in review')!.onClick();
    items.find(i => i.title === 'Restart queue from beginning')!.onClick();

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
