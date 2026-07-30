import { describe, it, expect } from 'vitest';
import { formatRemaining } from '../src/format-duration';

describe('formatRemaining', () => {
  it('returns "now" for zero or negative durations', () => {
    expect(formatRemaining(0)).toBe('now');
    expect(formatRemaining(-1000)).toBe('now');
  });

  it('formats sub-minute durations as 1m', () => {
    expect(formatRemaining(30_000)).toBe('1m');
  });

  it('formats minutes', () => {
    expect(formatRemaining(45 * 60_000)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatRemaining(3 * 3_600_000 + 15 * 60_000)).toBe('3h 15m');
  });

  it('formats days and hours', () => {
    expect(formatRemaining(2 * 86_400_000 + 5 * 3_600_000)).toBe('2d 5h');
  });
});
