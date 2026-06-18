import { describe, it, expect } from 'vitest';
import { CondicionCursada } from '../../value-objects/condicion-cursada';

describe('CondicionCursada', () => {
  describe('create()', () => {
    it.each(['APROBADO', 'DESAPROBADO', 'AUSENTE'])('creates %s without throwing', (value) => {
      const c = CondicionCursada.create(value);
      expect(c.get()).toBe(value);
    });

    it('throws on invalid value REGULAR', () => {
      expect(() => CondicionCursada.create('REGULAR')).toThrow('CondicionCursada inválida');
    });

    it('throws on empty string', () => {
      expect(() => CondicionCursada.create('')).toThrow('CondicionCursada inválida');
    });
  });

  describe('equals()', () => {
    it('equals same condicion', () => {
      const a = CondicionCursada.create('APROBADO');
      const b = CondicionCursada.create('APROBADO');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different condicion', () => {
      const a = CondicionCursada.create('APROBADO');
      const b = CondicionCursada.create('AUSENTE');
      expect(a.equals(b)).toBe(false);
    });
  });
});
