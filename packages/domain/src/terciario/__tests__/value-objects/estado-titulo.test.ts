import { describe, it, expect } from 'vitest';
import { EstadoTitulo } from '../../value-objects/estado-titulo';

describe('EstadoTitulo', () => {
  describe('create()', () => {
    it.each(['EN_TRAMITE', 'EMITIDO', 'ENTREGADO'])('creates %s', (e) => {
      const et = EstadoTitulo.create(e);
      expect(et.get()).toBe(e);
    });

    it('throws on invalid estado', () => {
      expect(() => EstadoTitulo.create('RECHAZADO')).toThrow('EstadoTitulo inválido');
    });

    it('throws on empty string', () => {
      expect(() => EstadoTitulo.create('')).toThrow('EstadoTitulo inválido');
    });
  });

  describe('equals()', () => {
    it('equals same estado', () => {
      const a = EstadoTitulo.create('EN_TRAMITE');
      const b = EstadoTitulo.create('EN_TRAMITE');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different estado', () => {
      const a = EstadoTitulo.create('EN_TRAMITE');
      const b = EstadoTitulo.create('ENTREGADO');
      expect(a.equals(b)).toBe(false);
    });
  });
});
