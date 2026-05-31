import { describe, it, expect } from 'vitest';
import { EstadoInscripcion } from '../../value-objects/estado-inscripcion';

describe('EstadoInscripcion', () => {
  describe('create()', () => {
    it.each(['INSCRIPTO', 'CURSANDO', 'REGULAR', 'APROBADO', 'LIBRE'])('creates %s', (e) => {
      const ei = EstadoInscripcion.create(e);
      expect(ei.get()).toBe(e);
    });

    it('throws on invalid estado', () => {
      expect(() => EstadoInscripcion.create('PENDIENTE')).toThrow('EstadoInscripcion inválido');
    });

    it('throws on empty string', () => {
      expect(() => EstadoInscripcion.create('')).toThrow('EstadoInscripcion inválido');
    });
  });

  describe('equals()', () => {
    it('equals same estado', () => {
      const a = EstadoInscripcion.create('APROBADO');
      const b = EstadoInscripcion.create('APROBADO');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different estado', () => {
      const a = EstadoInscripcion.create('INSCRIPTO');
      const b = EstadoInscripcion.create('LIBRE');
      expect(a.equals(b)).toBe(false);
    });
  });
});
