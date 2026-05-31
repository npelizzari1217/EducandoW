import { describe, it, expect } from 'vitest';
import { Trimestre } from '../../value-objects/trimestre';

describe('Trimestre', () => {
  describe('create()', () => {
    it.each(['1T', '2T', '3T'])('creates trimestre %s', (t) => {
      const r = Trimestre.create(t);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe(t);
    });

    it('normalizes lowercase', () => {
      const r = Trimestre.create('1t');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe('1T');
    });

    it('trims whitespace', () => {
      const r = Trimestre.create('  2T  ');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe('2T');
    });

    it('rejects invalid trimestre', () => {
      const r = Trimestre.create('4T');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Trimestre inválido');
    });

    it('rejects empty string', () => {
      const r = Trimestre.create('');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same trimestre', () => {
      const a = Trimestre.create('1T').unwrap();
      const b = Trimestre.create('1T').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different trimestre', () => {
      const a = Trimestre.create('1T').unwrap();
      const b = Trimestre.create('3T').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(Trimestre.create('2T').unwrap().toString()).toBe('2T');
    });
  });
});
