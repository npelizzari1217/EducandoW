import { describe, it, expect } from 'vitest';
import { Periodo } from '../../value-objects/periodo';

describe('Periodo', () => {
  describe('create()', () => {
    it('creates with 1T', () => {
      const r = Periodo.create('1T');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('1T');
    });

    it('creates with 2T', () => {
      const r = Periodo.create('2T');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('2T');
    });

    it('creates with 3T', () => {
      const r = Periodo.create('3T');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('3T');
    });

    it('rejects invalid period like 4T', () => {
      const r = Periodo.create('4T');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('1T, 2T, or 3T');
    });

    it('rejects empty string', () => {
      const r = Periodo.create('');
      expect(r.isErr()).toBe(true);
    });

    it('rejects arbitrary text', () => {
      const r = Periodo.create('ANUAL');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs a valid period', () => {
      const p = Periodo.reconstruct('2T');
      expect(p.get()).toBe('2T');
    });
  });

  describe('equals()', () => {
    it('equals same period', () => {
      const a = Periodo.reconstruct('1T');
      const b = Periodo.reconstruct('1T');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different period', () => {
      const a = Periodo.reconstruct('1T');
      const b = Periodo.reconstruct('3T');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(Periodo.reconstruct('3T').toString()).toBe('3T');
    });
  });
});
