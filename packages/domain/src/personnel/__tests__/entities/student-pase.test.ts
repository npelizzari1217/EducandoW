import { describe, it, expect } from 'vitest';
import { Student } from '../../entities/student';
import { Dni } from '../../value-objects/dni';
import { Id } from '../../../shared/value-objects/id';
import { PaseFechaInvalidaError } from '../../../shared/errors/pase-fecha-invalida-error';

const baseProps = {
  id: Id.reconstruct('student-1'),
  firstName: 'Juan',
  lastName: 'Pérez',
  dni: Dni.reconstruct('12345678'),
};

const pastDate = new Date('2026-06-01');
const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // +7 days

describe('Student — pase de egreso', () => {
  describe('reconstruct con fechaDePase', () => {
    it('tienePase es true cuando fechaDePase está seteado', () => {
      const s = Student.reconstruct({ ...baseProps, fechaDePase: pastDate });
      expect(s.tienePase).toBe(true);
    });

    it('tienePase es false cuando fechaDePase es undefined', () => {
      const s = Student.reconstruct({ ...baseProps, fechaDePase: undefined });
      expect(s.tienePase).toBe(false);
    });

    it('fechaDePase getter devuelve la fecha reconstructed', () => {
      const s = Student.reconstruct({ ...baseProps, fechaDePase: pastDate });
      expect(s.fechaDePase).toEqual(pastDate);
    });
  });

  describe('create', () => {
    it('tienePase es false por defecto al crear', () => {
      const s = Student.create({ firstName: 'Ana', lastName: 'López', dni: Dni.reconstruct('87654321') });
      expect(s.tienePase).toBe(false);
      expect(s.fechaDePase).toBeUndefined();
    });
  });

  describe('registrarPase', () => {
    it('setea fechaDePase con una fecha pasada válida', () => {
      const s = Student.reconstruct({ ...baseProps });
      s.registrarPase(pastDate);
      expect(s.fechaDePase).toEqual(pastDate);
      expect(s.tienePase).toBe(true);
    });

    it('lanza PaseFechaInvalidaError si la fecha es futura', () => {
      const s = Student.reconstruct({ ...baseProps });
      expect(() => s.registrarPase(futureDate)).toThrow(PaseFechaInvalidaError);
    });

    it('sobrescribe un pase existente con nueva fecha válida (idempotente)', () => {
      const s = Student.reconstruct({ ...baseProps, fechaDePase: pastDate });
      const newDate = new Date('2026-06-10');
      s.registrarPase(newDate);
      expect(s.fechaDePase).toEqual(newDate);
    });
  });

  describe('revertirPase', () => {
    it('setea fechaDePase a undefined y tienePase a false', () => {
      const s = Student.reconstruct({ ...baseProps, fechaDePase: pastDate });
      s.revertirPase();
      expect(s.fechaDePase).toBeUndefined();
      expect(s.tienePase).toBe(false);
    });

    it('no lanza error si el alumno no tiene pase (idempotente)', () => {
      const s = Student.reconstruct({ ...baseProps });
      expect(() => s.revertirPase()).not.toThrow();
      expect(s.tienePase).toBe(false);
    });
  });
});
