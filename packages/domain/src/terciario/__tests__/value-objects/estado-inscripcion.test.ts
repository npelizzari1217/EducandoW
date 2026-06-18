import { describe, it, expect } from 'vitest';
import { EstadoInscripcion } from '../../value-objects/estado-inscripcion';

describe('EstadoInscripcion', () => {
  describe('create()', () => {
    it.each(['INSCRIPTO', 'CURSANDO', 'REGULAR', 'APROBADO', 'LIBRE'])('creates %s', (e) => {
      const ei = EstadoInscripcion.create(e);
      expect(ei.get()).toBe(e);
    });

    it('creates PROMOCIONAL', () => {
      const ei = EstadoInscripcion.create('PROMOCIONAL');
      expect(ei.get()).toBe('PROMOCIONAL');
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

  describe('helpers', () => {
    it('esRegular() returns true only for REGULAR', () => {
      expect(EstadoInscripcion.create('REGULAR').esRegular()).toBe(true);
      expect(EstadoInscripcion.create('PROMOCIONAL').esRegular()).toBe(false);
      expect(EstadoInscripcion.create('LIBRE').esRegular()).toBe(false);
    });

    it('esLibre() returns true only for LIBRE', () => {
      expect(EstadoInscripcion.create('LIBRE').esLibre()).toBe(true);
      expect(EstadoInscripcion.create('REGULAR').esLibre()).toBe(false);
    });

    it('esPromocional() returns true only for PROMOCIONAL', () => {
      expect(EstadoInscripcion.create('PROMOCIONAL').esPromocional()).toBe(true);
      expect(EstadoInscripcion.create('REGULAR').esPromocional()).toBe(false);
    });

    it('esConfirmada() returns true for REGULAR, PROMOCIONAL, LIBRE, APROBADO', () => {
      expect(EstadoInscripcion.create('REGULAR').esConfirmada()).toBe(true);
      expect(EstadoInscripcion.create('PROMOCIONAL').esConfirmada()).toBe(true);
      expect(EstadoInscripcion.create('LIBRE').esConfirmada()).toBe(true);
      expect(EstadoInscripcion.create('APROBADO').esConfirmada()).toBe(true);
    });

    it('esConfirmada() returns false for INSCRIPTO, CURSANDO', () => {
      expect(EstadoInscripcion.create('INSCRIPTO').esConfirmada()).toBe(false);
      expect(EstadoInscripcion.create('CURSANDO').esConfirmada()).toBe(false);
    });
  });
});
