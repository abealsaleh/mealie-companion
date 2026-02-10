import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDateParam, getPlanRange, getRangeLabel } from '../../js/utils.js';
import { PLAN_DAYS } from '../../js/constants.js';

describe('formatDateParam()', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(formatDateParam(new Date(2025, 5, 15))).toBe('2025-06-15');
  });

  it('zero-pads month and day', () => {
    expect(formatDateParam(new Date(2025, 0, 3))).toBe('2025-01-03');
  });
});

describe('getPlanRange()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start is at midnight today', () => {
    const { start } = getPlanRange();
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it('end is PLAN_DAYS - 1 days later', () => {
    const { start, end } = getPlanRange();
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(PLAN_DAYS - 1);
  });
});

describe('getRangeLabel()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats like "Jun 15 – Jun 22"', () => {
    vi.setSystemTime(new Date(2025, 5, 15));
    const label = getRangeLabel();
    expect(label).toBe('Jun 15 \u2013 Jun 22');
  });

  it('handles month boundaries', () => {
    vi.setSystemTime(new Date(2025, 0, 28));
    const label = getRangeLabel();
    expect(label).toBe('Jan 28 \u2013 Feb 4');
  });
});
