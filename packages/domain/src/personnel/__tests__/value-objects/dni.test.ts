import { describe, it, expect } from 'vitest';
import { Dni } from '../../value-objects/dni';

describe('Dni', () => {
  describe('create()', () => {
    it('creates a valid DNI with 8 digits', () => {
      const r = Dni.create('12345678');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('12345678');
    });

    it('creates a valid DNI with 7 digits', () => {
      const r = Dni.create('1234567');
      expect(r.unwrap().get()).toBe('1234567');
    });

    it('strips dots and dashes', () => {
      const r = Dni.create('12.345.678');
      expect(r.unwrap().get()).toBe('12345678');
    });

    it('strips dashes', () => {
      const r = Dni.create('12-345-678');
      expect(r.unwrap().get()).toBe('12345678');
    });

    it('trims whitespace', () => {
      const r = Dni.create('  12345678  ');
      expect(r.unwrap().get()).toBe('12345678');
    });

    it('rejects less than 6 characters', () => {
      const r = Dni.create('12345');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('6–12 alphanumeric');
    });

    it('rejects more than 12 characters', () => {
      const r = Dni.create('1234567890123');
      expect(r.isErr()).toBe(true);
    });

    it('rejects symbols', () => {
      const r = Dni.create('1234@678');
      expect(r.isErr()).toBe(true);
    });

    it('rejects empty string', () => {
      const r = Dni.create('');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same DNI', () => {
      const a = Dni.reconstruct('12345678');
      const b = Dni.reconstruct('12345678');
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different DNI', () => {
      const a = Dni.reconstruct('12345678');
      const b = Dni.reconstruct('87654321');
      expect(a.equals(b)).toBe(false);
    });
  });
});
