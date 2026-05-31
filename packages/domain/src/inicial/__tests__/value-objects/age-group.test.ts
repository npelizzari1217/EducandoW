import { describe, it, expect } from 'vitest';
import { AgeGroup } from '../../value-objects/age-group';

describe('AgeGroup', () => {
  describe('create()', () => {
    it('creates with valid age 3', () => {
      const r = AgeGroup.create(3);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(3);
    });

    it('creates with valid age 4', () => {
      const r = AgeGroup.create(4);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(4);
    });

    it('creates with valid age 5', () => {
      const r = AgeGroup.create(5);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(5);
    });

    it('rejects age 6 as invalid', () => {
      const r = AgeGroup.create(6);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('AgeGroup must be 3, 4, or 5');
    });

    it('rejects age 0', () => {
      const r = AgeGroup.create(0);
      expect(r.isErr()).toBe(true);
    });

    it('rejects age 2', () => {
      const r = AgeGroup.create(2);
      expect(r.isErr()).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs a valid age group', () => {
      const ag = AgeGroup.reconstruct(4);
      expect(ag.get()).toBe(4);
    });
  });

  describe('equals()', () => {
    it('equals same age group', () => {
      const a = AgeGroup.reconstruct(3);
      const b = AgeGroup.reconstruct(3);
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different age group', () => {
      const a = AgeGroup.reconstruct(3);
      const b = AgeGroup.reconstruct(5);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(AgeGroup.reconstruct(4).toString()).toBe('4');
    });
  });
});
