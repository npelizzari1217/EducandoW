import { describe, it, expect } from 'vitest';
import { Turno } from '../../value-objects/turno';

describe('Turno', () => {
  describe('create()', () => {
    it('creates MAÑANA', () => {
      const r = Turno.create('MAÑANA');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('MAÑANA');
    });

    it('creates TARDE', () => {
      const r = Turno.create('TARDE');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('TARDE');
    });

    it('rejects invalid turno value', () => {
      const r = Turno.create('NOCHE');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('MAÑANA or TARDE');
    });

    it('rejects empty string', () => {
      const r = Turno.create('');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs a valid turno', () => {
      const t = Turno.reconstruct('TARDE');
      expect(t.get()).toBe('TARDE');
    });
  });

  describe('equals()', () => {
    it('equals same turno', () => {
      const a = Turno.reconstruct('MAÑANA');
      const b = Turno.reconstruct('MAÑANA');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different turno', () => {
      const a = Turno.reconstruct('MAÑANA');
      const b = Turno.reconstruct('TARDE');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(Turno.reconstruct('MAÑANA').toString()).toBe('MAÑANA');
    });
  });
});
