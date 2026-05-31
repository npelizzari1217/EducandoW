import { describe, it, expect } from 'vitest';
import { RegimenMateria } from '../../value-objects/regimen-materia';

describe('RegimenMateria', () => {
  describe('create()', () => {
    it.each(['PROMOCIONAL', 'REGULAR', 'LIBRE'])('creates %s', (r) => {
      const rm = RegimenMateria.create(r);
      expect(rm.get()).toBe(r);
    });

    it('throws on invalid regimen', () => {
      expect(() => RegimenMateria.create('INVALIDO')).toThrow('RegimenMateria inválido');
    });

    it('throws on empty string', () => {
      expect(() => RegimenMateria.create('')).toThrow('RegimenMateria inválido');
    });
  });

  describe('equals()', () => {
    it('equals same regimen', () => {
      const a = RegimenMateria.create('REGULAR');
      const b = RegimenMateria.create('REGULAR');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different regimen', () => {
      const a = RegimenMateria.create('PROMOCIONAL');
      const b = RegimenMateria.create('LIBRE');
      expect(a.equals(b)).toBe(false);
    });
  });
});
