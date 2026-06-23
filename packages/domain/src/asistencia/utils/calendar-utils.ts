/**
 * calendar-utils — single source of truth for all calendar derivation.
 * Pure TypeScript, zero external dependencies (only native Date).
 * Satisfies: REQ-UTIL-1, REQ-UTIL-2, REQ-UTIL-3, REQ-UTIL-4
 *
 * IMPORTANT — timezone safety:
 * Always use the component constructor `new Date(year, monthIndex, day)` (local time),
 * NEVER string-parse `new Date("YYYY-MM-DD")` which is interpreted in UTC and can shift
 * the date by one day in UTC-negative timezones (e.g., Argentina UTC-3).
 */

/**
 * Returns the number of days in the given year/month.
 * `month` is 1-based (January = 1, December = 12).
 *
 * Trick: `new Date(year, month, 0)` rolls back to the last day of the previous month,
 * so `new Date(year, 2, 0)` = last day of February, which handles leap years automatically.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the day-of-week for the given date.
 * Return value: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 *
 * Uses component constructor with monthIndex = month - 1 (0-based).
 * Never parses ISO strings to avoid UTC timezone shift bug.
 */
export function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

/**
 * Builds the locked-day map for a given year/month.
 * Iterates d = 1..31 (the fixed grid width):
 *   - d > daysInMonth(year, month) → "X" (non-existent day)
 *   - dayOfWeek === 6 (Saturday)   → "SAB"
 *   - dayOfWeek === 0 (Sunday)     → "DOM"
 *   - hábil day (Mon–Fri, exists)  → skipped (no entry)
 *
 * Returns only the locked keys: e.g., { "4": "SAB", "5": "DOM", "29": "X", ... }
 */
export function buildLockedDayMap(year: number, month: number): Record<string, string> {
  const max = daysInMonth(year, month);
  const out: Record<string, string> = {};

  for (let d = 1; d <= 31; d++) {
    if (d > max) {
      out[String(d)] = 'X';
      continue;
    }
    const dow = dayOfWeek(year, month, d);
    if (dow === 6) out[String(d)] = 'SAB';
    else if (dow === 0) out[String(d)] = 'DOM';
    // hábil days: no entry added
  }

  return out;
}
