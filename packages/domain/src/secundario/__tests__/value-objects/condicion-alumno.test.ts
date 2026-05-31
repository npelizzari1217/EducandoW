import { describe, it, expect } from 'vitest';
import { CondicionAlumno } from '../../value-objects/condicion-alumno';

describe('CondicionAlumno', () => {
  describe('create()', () => {
    it.each(['APROBADO', 'PREVIA', 'LIBRE'])('creates %s', (c) => {
      const r = CondicionAlumno.create(c);
      expect(r).not.toBeNull();
      expect(r!.get()).toBe(c);
    });

    it('returns null for invalid condicion', () => {
      const r = CondicionAlumno.create('REPROBADO');
      expect(r).toBeNull();
    });

    it('returns null for empty string', () => {
      const r = CondicionAlumno.create('');
      expect(r).toBeNull();
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with valid code', () => {
      const c = CondicionAlumno.reconstruct('LIBRE');
      expect(c.get()).toBe('LIBRE');
    });
  });

  describe('equals()', () => {
    it('equals same condicion', () => {
      const a = CondicionAlumno.reconstruct('APROBADO');
      const b = CondicionAlumno.reconstruct('APROBADO');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different condicion', () => {
      const a = CondicionAlumno.reconstruct('APROBADO');
      const b = CondicionAlumno.reconstruct('PREVIA');
      expect(a.equals(b)).toBe(false);
    });
  });
});
