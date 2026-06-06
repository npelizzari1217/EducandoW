import { describe, it, expect } from 'vitest';
import { GradingPeriod } from '../../value-objects/grading-period';

describe('GradingPeriod', () => {
  describe('create() — BIMESTER (default)', () => {
    it('accepts value 1', () => {
      const r = GradingPeriod.create(1);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe(1);
      expect(r.unwrap().periodType).toBe('BIMESTER');
    });

    it('accepts value 2', () => {
      const r = GradingPeriod.create(2);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe(2);
    });

    it('accepts value 4 (max for BIMESTER)', () => {
      const r = GradingPeriod.create(4);
      expect(r.isOk()).toBe(true);
    });

    it('rejects value 0', () => {
      const r = GradingPeriod.create(0);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('1');
    });

    it('rejects value 5 (above max for BIMESTER)', () => {
      const r = GradingPeriod.create(5);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('4');
    });

    it('rejects non-integer value', () => {
      const r = GradingPeriod.create(1.5);
      expect(r.isErr()).toBe(true);
    });
  });

  describe('create() — TRIMESTER', () => {
    it('accepts value 1 for TRIMESTER', () => {
      const r = GradingPeriod.create(1, 'TRIMESTER');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().periodType).toBe('TRIMESTER');
    });

    it('accepts value 3 (max for TRIMESTER)', () => {
      const r = GradingPeriod.create(3, 'TRIMESTER');
      expect(r.isOk()).toBe(true);
    });

    it('rejects value 4 for TRIMESTER (above max)', () => {
      const r = GradingPeriod.create(4, 'TRIMESTER');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('3');
    });

    it('rejects value 0 for TRIMESTER', () => {
      const r = GradingPeriod.create(0, 'TRIMESTER');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same value and periodType', () => {
      const a = GradingPeriod.create(2).unwrap();
      const b = GradingPeriod.create(2).unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different value', () => {
      const a = GradingPeriod.create(2).unwrap();
      const b = GradingPeriod.create(3).unwrap();
      expect(a.equals(b)).toBe(false);
    });

    it('does not equal different periodType', () => {
      const a = GradingPeriod.create(2, 'BIMESTER').unwrap();
      const b = GradingPeriod.create(2, 'TRIMESTER').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs without validation', () => {
      const gp = GradingPeriod.reconstruct(3, 'TRIMESTER');
      expect(gp.value).toBe(3);
      expect(gp.periodType).toBe('TRIMESTER');
    });
  });
});
