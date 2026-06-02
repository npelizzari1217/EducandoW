import { describe, it, expect } from 'vitest';
import { PassingGrade } from '../../value-objects/passing-grade';

describe('PassingGrade', () => {
  describe('create()', () => {
    it('accepts minimum valid grade (1)', () => {
      const r = PassingGrade.create(1);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(1);
    });

    it('accepts maximum valid grade (10)', () => {
      const r = PassingGrade.create(10);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(10);
    });

    it('accepts grade in the middle (6)', () => {
      const r = PassingGrade.create(6);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(6);
    });

    it('accepts grade with decimal (7.5)', () => {
      const r = PassingGrade.create(7.5);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(7.5);
    });

    it('rejects grade below 1', () => {
      const r = PassingGrade.create(0);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('between 1 and 10');
    });

    it('rejects grade above 10', () => {
      const r = PassingGrade.create(11);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('between 1 and 10');
    });

    it('rejects negative grade', () => {
      const r = PassingGrade.create(-1);
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same grade', () => {
      const a = PassingGrade.reconstruct(6);
      const b = PassingGrade.reconstruct(6);
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different grade', () => {
      const a = PassingGrade.reconstruct(7);
      const b = PassingGrade.reconstruct(10);
      expect(a.equals(b)).toBe(false);
    });
  });
});
