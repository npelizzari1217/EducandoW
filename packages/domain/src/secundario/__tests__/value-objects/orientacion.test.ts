import { describe, it, expect } from 'vitest';
import { Orientacion } from '../../value-objects/orientacion';

describe('Orientacion', () => {
  describe('create()', () => {
    it.each(['NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE'])('creates %s', (o) => {
      const r = Orientacion.create(o);
      expect(r).not.toBeNull();
      expect(r!.get()).toBe(o);
    });

    it('returns null for invalid orientation', () => {
      const r = Orientacion.create('TECNICO');
      expect(r).toBeNull();
    });

    it('returns null for empty string', () => {
      const r = Orientacion.create('');
      expect(r).toBeNull();
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with valid code', () => {
      const o = Orientacion.reconstruct('NATURALES');
      expect(o.get()).toBe('NATURALES');
    });
  });

  describe('equals()', () => {
    it('equals same orientation', () => {
      const a = Orientacion.reconstruct('ARTE');
      const b = Orientacion.reconstruct('ARTE');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different orientation', () => {
      const a = Orientacion.reconstruct('NATURALES');
      const b = Orientacion.reconstruct('ECONOMIA');
      expect(a.equals(b)).toBe(false);
    });
  });
});
