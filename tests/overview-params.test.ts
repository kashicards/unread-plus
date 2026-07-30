import { describe, it, expect } from 'vitest';
import { parseOverviewParams } from '../src/overview-params';

const knownStatusIds = ['unread', 'later'];

describe('parseOverviewParams', () => {
  it('returns sensible defaults for an empty block', () => {
    const params = parseOverviewParams('', knownStatusIds);
    expect(params).toEqual({
      statusIds: null,
      folder: null,
      limit: 20,
      sort: 'created',
      showStats: true,
      showList: true,
    });
  });

  it('parses a comma-separated status filter, dropping unknown IDs', () => {
    const params = parseOverviewParams('status: unread, bogus, later', knownStatusIds);
    expect(params.statusIds).toEqual(['unread', 'later']);
  });

  it('parses a folder filter', () => {
    const params = parseOverviewParams('folder: 01-Life/News', knownStatusIds);
    expect(params.folder).toBe('01-Life/News');
  });

  it('parses a numeric limit, falling back to 20 on invalid input', () => {
    expect(parseOverviewParams('limit: 5', knownStatusIds).limit).toBe(5);
    expect(parseOverviewParams('limit: abc', knownStatusIds).limit).toBe(20);
  });

  it('maps sort: age to the created order, passes through folder/random, and falls back to created for unknown values', () => {
    expect(parseOverviewParams('sort: age', knownStatusIds).sort).toBe('created');
    expect(parseOverviewParams('sort: folder', knownStatusIds).sort).toBe('folder');
    expect(parseOverviewParams('sort: random', knownStatusIds).sort).toBe('random');
    expect(parseOverviewParams('sort: bogus', knownStatusIds).sort).toBe('created');
  });

  it('parses show to toggle stats/list independently', () => {
    expect(parseOverviewParams('show: stats', knownStatusIds)).toMatchObject({ showStats: true, showList: false });
    expect(parseOverviewParams('show: list', knownStatusIds)).toMatchObject({ showStats: false, showList: true });
  });

  it('ignores blank lines and lines without a colon', () => {
    const params = parseOverviewParams('\nstatus: unread\n\ngarbage line\nlimit: 3\n', knownStatusIds);
    expect(params.statusIds).toEqual(['unread']);
    expect(params.limit).toBe(3);
  });
});
