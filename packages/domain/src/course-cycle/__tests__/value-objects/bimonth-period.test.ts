import { describe, it, expect } from 'vitest';
import { BimonthPeriod } from '../../value-objects/bimonth-period';

describe('BimonthPeriod', () => {
  describe('create()', () => {
    it('accepts valid period where end > start', () => {
      const start = new Date('2026-03-01');
      const end = new Date('2026-04-30');
      const r = BimonthPeriod.create(start, end);
      expect(r.isOk()).toBe(true);
      const period = r.unwrap();
      expect(period.start).toEqual(start);
      expect(period.end).toEqual(end);
    });

    it('accepts period with one day difference', () => {
      const start = new Date('2026-03-01');
      const end = new Date('2026-03-02');
      const r = BimonthPeriod.create(start, end);
      expect(r.isOk()).toBe(true);
    });

    it('accepts period spanning multiple months', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-12-31');
      const r = BimonthPeriod.create(start, end);
      expect(r.isOk()).toBe(true);
    });

    it('rejects when end equals start', () => {
      const start = new Date('2026-03-01');
      const end = new Date('2026-03-01');
      const r = BimonthPeriod.create(start, end);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('must be after');
    });

    it('rejects when end is before start', () => {
      const start = new Date('2026-04-30');
      const end = new Date('2026-03-01');
      const r = BimonthPeriod.create(start, end);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('must be after');
    });
  });

  describe('equals()', () => {
    it('equals same period', () => {
      const a = BimonthPeriod.create(new Date('2026-03-01'), new Date('2026-04-30')).unwrap();
      const b = BimonthPeriod.create(new Date('2026-03-01'), new Date('2026-04-30')).unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different period', () => {
      const a = BimonthPeriod.create(new Date('2026-01-01'), new Date('2026-02-28')).unwrap();
      const b = BimonthPeriod.create(new Date('2026-03-01'), new Date('2026-04-30')).unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });
});
