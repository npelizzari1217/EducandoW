import { describe, it, expect } from 'vitest';
import { GradoNumero } from '../../value-objects/grado-numero';

describe('GradoNumero', () => {
  describe('create()', () => {
    it.each([1, 2, 3, 4, 5, 6])('creates with valid grade %i', (g) => {
      const r = GradoNumero.create(g);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe(g);
    });

    it('rejects grade 0', () => {
      const r = GradoNumero.create(0);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Grado inválido');
    });

    it('rejects grade 7', () => {
      const r = GradoNumero.create(7);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Grado inválido');
    });

    it('rejects negative grade', () => {
      const r = GradoNumero.create(-1);
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same grade number', () => {
      const a = GradoNumero.create(3).unwrap();
      const b = GradoNumero.create(3).unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different grade number', () => {
      const a = GradoNumero.create(1).unwrap();
      const b = GradoNumero.create(6).unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(GradoNumero.create(5).unwrap().toString()).toBe('5');
    });
  });
});
