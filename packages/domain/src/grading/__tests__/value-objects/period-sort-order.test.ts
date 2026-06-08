import { describe, it, expect } from 'vitest';
import { PeriodSortOrder } from '../../value-objects/period-sort-order';
import { PeriodSortOrderInvalidError } from '../../errors/grading-period.errors';

describe('PeriodSortOrder', () => {
  describe('create()', () => {
    it('accepts sortOrder = 1 (minimum valid)', () => {
      const result = PeriodSortOrder.create(1);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().get()).toBe(1);
    });

    it('accepts sortOrder > 1', () => {
      const result = PeriodSortOrder.create(5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().get()).toBe(5);
    });

    it('rejects sortOrder = 0 with PeriodSortOrderInvalidError', () => {
      const result = PeriodSortOrder.create(0);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(PeriodSortOrderInvalidError);
    });

    it('rejects negative sortOrder with PeriodSortOrderInvalidError', () => {
      const result = PeriodSortOrder.create(-1);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(PeriodSortOrderInvalidError);
    });

    it('rejects non-integer (float) sortOrder', () => {
      const result = PeriodSortOrder.create(1.5);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(PeriodSortOrderInvalidError);
    });
  });
});
