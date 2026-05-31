import { describe, it, expect } from 'vitest';
import { CondicionExamen } from '../../value-objects/condicion-examen';

describe('CondicionExamen', () => {
  describe('create()', () => {
    it.each(['APROBADO', 'DESAPROBADO', 'AUSENTE'])('creates %s', (c) => {
      const ce = CondicionExamen.create(c);
      expect(ce.get()).toBe(c);
    });

    it('throws on invalid condicion', () => {
      expect(() => CondicionExamen.create('RECURSA')).toThrow('CondicionExamen inválida');
    });

    it('throws on empty string', () => {
      expect(() => CondicionExamen.create('')).toThrow('CondicionExamen inválida');
    });
  });

  describe('equals()', () => {
    it('equals same condicion', () => {
      const a = CondicionExamen.create('APROBADO');
      const b = CondicionExamen.create('APROBADO');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different condicion', () => {
      const a = CondicionExamen.create('APROBADO');
      const b = CondicionExamen.create('DESAPROBADO');
      expect(a.equals(b)).toBe(false);
    });
  });
});
