import { describe, it, expect } from 'vitest';
import { GradingPeriodCalculator } from '../../services/grading-period-calculator';
import type { DateRange } from '../../services/grading-period-calculator';

function range(start: string, end: string): DateRange {
  return { start: new Date(start), end: new Date(end) };
}

describe('GradingPeriodCalculator', () => {
  describe('currentPeriod()', () => {
    it('returns null for empty ranges array', () => {
      expect(GradingPeriodCalculator.currentPeriod([])).toBeNull();
    });

    it('returns null when all ranges are in the past', () => {
      const ranges = [
        range('2020-03-01', '2020-04-30'),
        range('2020-05-01', '2020-06-30'),
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBeNull();
    });

    it('returns null when all ranges are in the future', () => {
      const ranges = [
        range('2099-03-01', '2099-04-30'),
        range('2099-05-01', '2099-06-30'),
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBeNull();
    });

    it('returns 1 when today falls in the first range', () => {
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - 5);
      const future = new Date(now);
      future.setDate(future.getDate() + 5);

      const ranges = [
        { start: past, end: future },
        range('2099-05-01', '2099-06-30'),
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBe(1);
    });

    it('returns 2 when today falls in the second range', () => {
      const now = new Date();
      const past2 = new Date(now);
      past2.setDate(past2.getDate() - 5);
      const future2 = new Date(now);
      future2.setDate(future2.getDate() + 5);

      const ranges = [
        range('2020-03-01', '2020-04-30'), // past
        { start: past2, end: future2 },    // active
        range('2099-09-01', '2099-10-31'), // future
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBe(2);
    });

    it('sorts ranges by start date before evaluating', () => {
      // Supply ranges out of order — calculator should sort them first
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - 5);
      const future = new Date(now);
      future.setDate(future.getDate() + 5);

      const ranges = [
        range('2099-09-01', '2099-10-31'),  // would be index 0 if not sorted
        { start: past, end: future },         // active — should be index 0 after sort
        range('2020-03-01', '2020-04-30'),   // past
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBe(2);
    });

    it('returns null when today falls in a gap between ranges', () => {
      const now = new Date();
      const wayPast = new Date(now);
      wayPast.setDate(wayPast.getDate() - 20);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const farFuture = new Date(now);
      farFuture.setDate(farFuture.getDate() + 20);

      const ranges = [
        { start: wayPast, end: yesterday }, // ended yesterday
        { start: tomorrow, end: farFuture }, // starts tomorrow
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBeNull();
    });

    it('includes boundary dates (inclusive start and end)', () => {
      // Exact boundary: today IS the start date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 10);

      const ranges = [{ start: today, end: endDate }];
      // today >= start && today <= end should be true
      const result = GradingPeriodCalculator.currentPeriod(ranges);
      expect(result).toBe(1);
    });

    it('filters out invalid ranges (start > end)', () => {
      // An invalid range (start after end) should be ignored
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - 5);
      const future = new Date(now);
      future.setDate(future.getDate() + 5);

      const ranges = [
        { start: future, end: past }, // invalid — reversed
      ];
      expect(GradingPeriodCalculator.currentPeriod(ranges)).toBeNull();
    });
  });
});
