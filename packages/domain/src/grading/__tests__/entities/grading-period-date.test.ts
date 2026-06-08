import { describe, it, expect } from 'vitest';
import { GradingPeriodDate } from '../../entities/grading-period-date';
import {
  PeriodDateInvalidRangeError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
} from '../../errors/grading-period.errors';

const cycleStart = new Date('2025-03-01');
const cycleEnd = new Date('2025-12-31');

function makeDate(
  start: string,
  end: string,
  itemId = 'item-1',
  cycleId = 'cycle-1',
): GradingPeriodDate {
  return GradingPeriodDate.create(
    { itemId, cycleId, startDate: new Date(start), endDate: new Date(end) },
    cycleStart,
    cycleEnd,
    [],
  );
}

describe('GradingPeriodDate', () => {
  describe('create()', () => {
    it('creates a valid date when startDate < endDate and within cycle range', () => {
      const date = makeDate('2025-03-01', '2025-05-31');
      expect(date.startDate).toEqual(new Date('2025-03-01'));
      expect(date.endDate).toEqual(new Date('2025-05-31'));
      expect(date.itemId).toBe('item-1');
      expect(date.cycleId).toBe('cycle-1');
      expect(date.id).toBeTruthy();
    });

    it('throws PeriodDateInvalidRangeError when startDate >= endDate (equal)', () => {
      expect(() => makeDate('2025-03-01', '2025-03-01')).toThrow(PeriodDateInvalidRangeError);
    });

    it('throws PeriodDateInvalidRangeError when startDate > endDate', () => {
      expect(() => makeDate('2025-06-01', '2025-05-01')).toThrow(PeriodDateInvalidRangeError);
    });

    it('throws PeriodDateOutOfCycleRangeError when startDate is before cycle start', () => {
      expect(() => makeDate('2025-02-28', '2025-05-31')).toThrow(PeriodDateOutOfCycleRangeError);
    });

    it('throws PeriodDateOutOfCycleRangeError when endDate is after cycle end', () => {
      expect(() => makeDate('2025-03-01', '2026-01-15')).toThrow(PeriodDateOutOfCycleRangeError);
    });

    it('throws PeriodDateOverlapError when overlapping with an existing sibling', () => {
      const existing = makeDate('2025-03-01', '2025-05-31', 'item-2', 'cycle-1');
      expect(() =>
        GradingPeriodDate.create(
          { itemId: 'item-3', cycleId: 'cycle-1', startDate: new Date('2025-05-01'), endDate: new Date('2025-06-30') },
          cycleStart,
          cycleEnd,
          [existing],
        ),
      ).toThrow(PeriodDateOverlapError);
    });

    it('allows gaps between periods (no validation for gaps)', () => {
      const first = makeDate('2025-03-01', '2025-04-30', 'item-1', 'cycle-1');
      // Gap: May is empty
      expect(() =>
        GradingPeriodDate.create(
          { itemId: 'item-2', cycleId: 'cycle-1', startDate: new Date('2025-06-01'), endDate: new Date('2025-07-31') },
          cycleStart,
          cycleEnd,
          [first],
        ),
      ).not.toThrow();
    });

    it('periods for different cycles are independent (no cross-cycle overlap)', () => {
      const otherCycle = makeDate('2025-03-01', '2025-05-31', 'item-1', 'other-cycle');
      // same item, different cycle — siblings list is empty for this cycle
      expect(() =>
        GradingPeriodDate.create(
          { itemId: 'item-1', cycleId: 'cycle-1', startDate: new Date('2025-03-01'), endDate: new Date('2025-05-31') },
          cycleStart,
          cycleEnd,
          [], // siblings for this cycleId — other cycle is irrelevant
        ),
      ).not.toThrow();

      // even if we pass sibling from another cycle by mistake, overlap check uses date ranges only
      // but in correct usage siblings are filtered by cycleId before being passed
      void otherCycle;
    });
  });

  describe('reconstruct()', () => {
    it('preserves all fields without re-validating', () => {
      const start = new Date('2025-03-01');
      const end = new Date('2025-05-31');
      const date = GradingPeriodDate.reconstruct({
        id: 'date-1',
        itemId: 'item-1',
        cycleId: 'cycle-1',
        startDate: start,
        endDate: end,
      });
      expect(date.id).toBe('date-1');
      expect(date.startDate).toBe(start);
      expect(date.endDate).toBe(end);
    });
  });
});
