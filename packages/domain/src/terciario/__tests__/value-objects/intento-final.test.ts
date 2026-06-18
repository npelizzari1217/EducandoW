import { describe, it, expect } from 'vitest';
import { IntentoFinal } from '../../value-objects/intento-final';

describe('IntentoFinal', () => {
  describe('create()', () => {
    it.each([1, 2, 3])('creates %s without throwing', (n) => {
      const intento = IntentoFinal.create(n);
      expect(intento.get()).toBe(n);
    });

    it('throws for 0', () => {
      expect(() => IntentoFinal.create(0)).toThrow();
    });

    it('throws for 4', () => {
      expect(() => IntentoFinal.create(4)).toThrow();
    });

    it('throws for -1', () => {
      expect(() => IntentoFinal.create(-1)).toThrow();
    });
  });

  describe('get()', () => {
    it('returns the numeric value', () => {
      expect(IntentoFinal.create(2).get()).toBe(2);
    });
  });
});
