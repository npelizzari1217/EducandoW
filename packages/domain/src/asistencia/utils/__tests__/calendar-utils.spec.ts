/**
 * calendar-utils unit tests — Strict TDD
 * Satisfies: REQ-UTIL-1..4, Scenarios UTIL-1..UTIL-12 + timezone safety
 */
import { describe, it, expect } from 'vitest';
import { daysInMonth, dayOfWeek, buildLockedDayMap, fillHabilVacios } from '../calendar-utils';

describe('daysInMonth', () => {
  it('UTIL-1: returns 28 for February 2025 (non-leap)', () => {
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('UTIL-2: returns 29 for February 2024 (leap)', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it('UTIL-3: returns 30 for April 2025 (30-day month)', () => {
    expect(daysInMonth(2025, 4)).toBe(30);
  });

  it('UTIL-4: returns 31 for December 2025 (31-day month)', () => {
    expect(daysInMonth(2025, 12)).toBe(31);
  });
});

describe('dayOfWeek', () => {
  it('UTIL-5: returns 6 (Saturday) for January 4 2025', () => {
    expect(dayOfWeek(2025, 1, 4)).toBe(6);
  });

  it('UTIL-6: returns 0 (Sunday) for January 5 2025', () => {
    expect(dayOfWeek(2025, 1, 5)).toBe(0);
  });

  it('UTIL-7: returns 1 (Monday) for January 6 2025', () => {
    expect(dayOfWeek(2025, 1, 6)).toBe(1);
  });

  it('timezone safety: uses component constructor (not string parse) — January 4 2025 is Saturday regardless of timezone', () => {
    // The component constructor new Date(year, monthIndex, day) uses LOCAL time.
    // ISO string parse (new Date("2025-01-04")) uses UTC and can shift to Jan 3 in UTC-negative zones.
    // This test verifies the correct constructor is used.
    expect(dayOfWeek(2025, 1, 4)).toBe(6); // Saturday
    expect(dayOfWeek(2025, 1, 5)).toBe(0); // Sunday
    expect(dayOfWeek(2025, 2, 1)).toBe(6); // Feb 1 2025 is Saturday
  });
});

describe('buildLockedDayMap', () => {
  it('UTIL-8: January 2025 — correct SAB/DOM entries, no X, no weekday keys', () => {
    const map = buildLockedDayMap(2025, 1);

    // All Saturdays in January 2025
    expect(map['4']).toBe('SAB');
    expect(map['11']).toBe('SAB');
    expect(map['18']).toBe('SAB');
    expect(map['25']).toBe('SAB');

    // All Sundays in January 2025
    expect(map['5']).toBe('DOM');
    expect(map['12']).toBe('DOM');
    expect(map['19']).toBe('DOM');
    expect(map['26']).toBe('DOM');

    // Weekdays must NOT be present
    expect(map['1']).toBeUndefined(); // Monday Jan 1
    expect(map['2']).toBeUndefined(); // Tuesday Jan 2
    expect(map['3']).toBeUndefined(); // Wednesday Jan 3
    expect(map['6']).toBeUndefined(); // Monday Jan 6

    // January has 31 days — no X entries
    const xEntries = Object.entries(map).filter(([, v]) => v === 'X');
    expect(xEntries).toHaveLength(0);
  });

  it('UTIL-9: February 2025 (28 days) — SABs, DOMs, and X for days 29/30/31; key 28 absent', () => {
    const map = buildLockedDayMap(2025, 2);

    // Saturdays
    expect(map['1']).toBe('SAB');
    expect(map['8']).toBe('SAB');
    expect(map['15']).toBe('SAB');
    expect(map['22']).toBe('SAB');

    // Sundays
    expect(map['2']).toBe('DOM');
    expect(map['9']).toBe('DOM');
    expect(map['16']).toBe('DOM');
    expect(map['23']).toBe('DOM');

    // Non-existent days
    expect(map['29']).toBe('X');
    expect(map['30']).toBe('X');
    expect(map['31']).toBe('X');

    // Day 28 is Friday (hábil) — must not be in the map
    expect(map['28']).toBeUndefined();
  });

  it('UTIL-10: February 2024 (29 days, leap) — X for 30/31; key 29 absent (day 29 exists)', () => {
    const map = buildLockedDayMap(2024, 2);

    // Saturdays
    expect(map['3']).toBe('SAB');
    expect(map['10']).toBe('SAB');
    expect(map['17']).toBe('SAB');
    expect(map['24']).toBe('SAB');

    // Sundays
    expect(map['4']).toBe('DOM');
    expect(map['11']).toBe('DOM');
    expect(map['18']).toBe('DOM');
    expect(map['25']).toBe('DOM');

    // Non-existent days for leap Feb 2024 (29 days)
    expect(map['30']).toBe('X');
    expect(map['31']).toBe('X');

    // Day 29 EXISTS in 2024 — must not be marked X
    expect(map['29']).toBeUndefined();
  });

  it('UTIL-11: April 2025 (30 days) — only key 31 is X; key 30 absent', () => {
    const map = buildLockedDayMap(2025, 4);

    // Only day 31 is non-existent for April
    expect(map['31']).toBe('X');

    // Day 30 EXISTS in April — must not be marked X
    expect(map['30']).toBeUndefined();

    // Verify some SAB/DOM entries for April 2025
    expect(map['5']).toBe('SAB');
    expect(map['6']).toBe('DOM');
    expect(map['12']).toBe('SAB');
    expect(map['13']).toBe('DOM');
    expect(map['19']).toBe('SAB');
    expect(map['20']).toBe('DOM');
    expect(map['26']).toBe('SAB');
    expect(map['27']).toBe('DOM');
  });

  it('UTIL-12: December 2025 (31 days) — SAB/DOM entries present; no X keys', () => {
    const map = buildLockedDayMap(2025, 12);

    // Saturdays in December 2025
    expect(map['6']).toBe('SAB');
    expect(map['13']).toBe('SAB');
    expect(map['20']).toBe('SAB');
    expect(map['27']).toBe('SAB');

    // Sundays in December 2025
    expect(map['7']).toBe('DOM');
    expect(map['14']).toBe('DOM');
    expect(map['21']).toBe('DOM');
    expect(map['28']).toBe('DOM');

    // December has 31 days — no X entries
    const xEntries = Object.entries(map).filter(([, v]) => v === 'X');
    expect(xEntries).toHaveLength(0);
  });
});

describe('fillHabilVacios', () => {
  it('FILL-1: empty grid — every existing hábil day (Mon-Fri) receives presenteCode (January 2025)', () => {
    const result = fillHabilVacios({}, 'P', 2025, 1);

    // Hábil days in January 2025 (Mon-Fri): 1,2,3,6,7,8,9,10,13,14,15,16,17,20,21,22,23,24,27,28,29,30,31
    expect(result['1']).toBe('P');
    expect(result['2']).toBe('P');
    expect(result['3']).toBe('P');
    expect(result['6']).toBe('P');
    expect(result['31']).toBe('P');
  });

  it('FILL-2: SAB/DOM/X (buildLockedDayMap) never receive presenteCode, even when the locked map is passed as `days` (real call pattern from the use-case)', () => {
    const locked = buildLockedDayMap(2025, 2); // Feb 2025, 28 days
    const result = fillHabilVacios(locked, 'P', 2025, 2);

    expect(result['1']).toBe('SAB');
    expect(result['2']).toBe('DOM');
    expect(result['29']).toBe('X');
    expect(result['30']).toBe('X');
    expect(result['31']).toBe('X');
    // hábil keys get filled alongside the preserved locked keys
    expect(result['3']).toBe('P');
  });

  it('FILL-2b: with an empty `days`, fillHabilVacios does not itself inject locked keys — it only skips filling them (contract: caller passes buildLockedDayMap as `days`)', () => {
    const result = fillHabilVacios({}, 'P', 2025, 2);

    expect(result['1']).toBeUndefined(); // SAB — not filled, not injected either
    expect(result['29']).toBeUndefined(); // X — not filled, not injected either
    expect(result['3']).toBe('P'); // hábil — filled
  });

  it('FILL-3: an existing hábil key (P/A/T/custom/FERIADO) is preserved regardless of its value', () => {
    const input = { '3': 'A', '6': 'T', '7': 'FERIADO', '8': 'CUSTOM' };
    const result = fillHabilVacios(input, 'P', 2025, 1);

    expect(result['3']).toBe('A');
    expect(result['6']).toBe('T');
    expect(result['7']).toBe('FERIADO');
    expect(result['8']).toBe('CUSTOM');
    // untouched hábil key still gets filled
    expect(result['2']).toBe('P');
  });

  it('FILL-4: is immutable — does not mutate the input `days` object', () => {
    const input = { '3': 'A' };
    const inputSnapshot = { ...input };
    fillHabilVacios(input, 'P', 2025, 1);

    expect(input).toEqual(inputSnapshot);
  });

  it('FILL-5: is idempotent — running twice yields the same result', () => {
    const input = { '3': 'A' };
    const once = fillHabilVacios(input, 'P', 2025, 1);
    const twice = fillHabilVacios(once, 'P', 2025, 1);

    expect(twice).toEqual(once);
  });

  it('FILL-6: works across 28/29/30/31-day months (Feb non-leap 2025, Feb leap 2024, Apr 2025, Dec 2025)', () => {
    const feb2025 = fillHabilVacios({}, 'P', 2025, 2); // 28 days
    expect(feb2025['28']).toBe('P'); // Friday, hábil
    expect(feb2025['29']).toBeUndefined();

    const feb2024 = fillHabilVacios({}, 'P', 2024, 2); // 29 days, leap
    expect(feb2024['29']).toBe('P'); // Thursday, hábil, exists in leap year
    expect(feb2024['30']).toBeUndefined();

    const apr2025 = fillHabilVacios({}, 'P', 2025, 4); // 30 days
    expect(apr2025['30']).toBe('P'); // Wednesday, hábil, last existing day of April
    expect(apr2025['31']).toBeUndefined(); // beyond daysInMonth(4) → loop never reaches it

    const dec2025 = fillHabilVacios({}, 'P', 2025, 12); // 31 days
    expect(dec2025['31']).toBe('P'); // Wednesday, hábil
  });
});
