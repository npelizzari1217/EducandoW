/**
 * DayMap VO unit tests — TDD RED phase
 * Spec: ADR-1; R-20
 */
import { describe, it, expect } from 'vitest';
import { DayMap } from '../../value-objects/day-map';

describe('DayMap', () => {
  describe('empty()', () => {
    it('creates an empty DayMap with no days set', () => {
      const dm = DayMap.empty();
      expect(dm.toJSON()).toEqual({});
    });

    it('get() on empty DayMap returns undefined for any day', () => {
      const dm = DayMap.empty();
      expect(dm.get(1)).toBeUndefined();
      expect(dm.get(15)).toBeUndefined();
      expect(dm.get(31)).toBeUndefined();
    });
  });

  describe('fromRecord()', () => {
    it('rehydrates a DayMap from an existing record', () => {
      const dm = DayMap.fromRecord({ '1': 'P', '15': 'A' });
      expect(dm.get(1)).toBe('P');
      expect(dm.get(15)).toBe('A');
    });

    it('toJSON() returns the original record shape', () => {
      const record = { '1': 'P', '2': 'A', '3': 'SAB' };
      const dm = DayMap.fromRecord(record);
      expect(dm.toJSON()).toEqual(record);
    });
  });

  describe('withDay()', () => {
    it('returns a new DayMap instance with the day set', () => {
      const original = DayMap.empty();
      const updated = original.withDay(1, 'P');
      expect(updated.get(1)).toBe('P');
    });

    it('is immutable — original is unchanged after withDay()', () => {
      const original = DayMap.empty();
      original.withDay(5, 'A');
      expect(original.get(5)).toBeUndefined();
    });

    it('withDay() returns a NEW instance (reference inequality)', () => {
      const original = DayMap.empty();
      const updated = original.withDay(1, 'P');
      expect(updated).not.toBe(original);
    });

    it('can chain withDay() calls building a cumulative map', () => {
      const dm = DayMap.empty().withDay(1, 'P').withDay(2, 'A').withDay(3, 'SAB');
      expect(dm.get(1)).toBe('P');
      expect(dm.get(2)).toBe('A');
      expect(dm.get(3)).toBe('SAB');
      expect(dm.toJSON()).toEqual({ '1': 'P', '2': 'A', '3': 'SAB' });
    });

    it('overwrites an existing day code', () => {
      const dm = DayMap.empty().withDay(1, 'P').withDay(1, 'A');
      expect(dm.get(1)).toBe('A');
    });
  });

  describe('validation — rejects invalid day numbers', () => {
    it('rejects day < 1', () => {
      expect(() => DayMap.empty().withDay(0, 'P')).toThrow();
    });

    it('rejects day < 1 (negative)', () => {
      expect(() => DayMap.empty().withDay(-1, 'P')).toThrow();
    });

    it('rejects day > 31', () => {
      expect(() => DayMap.empty().withDay(32, 'P')).toThrow();
    });

    it('accepts boundary day 1', () => {
      expect(() => DayMap.empty().withDay(1, 'P')).not.toThrow();
    });

    it('accepts boundary day 31', () => {
      expect(() => DayMap.empty().withDay(31, 'P')).not.toThrow();
    });
  });

  describe('validation — rejects invalid codes', () => {
    it('rejects empty string code', () => {
      expect(() => DayMap.empty().withDay(1, '')).toThrow();
    });

    it('accepts any non-empty code string (catalog validation is application-layer concern)', () => {
      expect(() => DayMap.empty().withDay(1, 'P')).not.toThrow();
      expect(() => DayMap.empty().withDay(1, 'A')).not.toThrow();
      expect(() => DayMap.empty().withDay(1, 'SAB')).not.toThrow();
      expect(() => DayMap.empty().withDay(1, 'CUSTOM')).not.toThrow();
    });
  });
});
