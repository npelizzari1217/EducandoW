import { describe, it, expect } from 'vitest';
import { TurnoExamen } from '../../value-objects/turno-examen';

describe('TurnoExamen', () => {
  describe('create()', () => {
    it.each(['DICIEMBRE', 'FEBRERO'])('creates %s', (t) => {
      const r = TurnoExamen.create(t);
      expect(r).not.toBeNull();
      expect(r!.get()).toBe(t);
    });

    it('returns null for invalid turno', () => {
      const r = TurnoExamen.create('MARZO');
      expect(r).toBeNull();
    });

    it('returns null for empty string', () => {
      const r = TurnoExamen.create('');
      expect(r).toBeNull();
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with valid code', () => {
      const t = TurnoExamen.reconstruct('FEBRERO');
      expect(t.get()).toBe('FEBRERO');
    });
  });

  describe('equals()', () => {
    it('equals same turno', () => {
      const a = TurnoExamen.reconstruct('DICIEMBRE');
      const b = TurnoExamen.reconstruct('DICIEMBRE');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different turno', () => {
      const a = TurnoExamen.reconstruct('DICIEMBRE');
      const b = TurnoExamen.reconstruct('FEBRERO');
      expect(a.equals(b)).toBe(false);
    });
  });
});
