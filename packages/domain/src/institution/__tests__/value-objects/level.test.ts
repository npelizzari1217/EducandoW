import { describe, it, expect } from 'vitest';
import { Level, LevelType } from '../../value-objects/level';

describe('Level', () => {
  describe('create()', () => {
    it.each([
      ['INICIAL', LevelType.INICIAL],
      ['inicial', LevelType.INICIAL],
      ['  inicial  ', LevelType.INICIAL],
      ['PRIMARIO', LevelType.PRIMARIO],
      ['primario', LevelType.PRIMARIO],
      ['SECUNDARIO', LevelType.SECUNDARIO],
      ['secundario', LevelType.SECUNDARIO],
      ['TERCIARIO', LevelType.TERCIARIO],
      ['terciario', LevelType.TERCIARIO],
    ])('creates Level.%s from "%s"', (input, expected) => {
      const r = Level.create(input);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(expected);
    });

    it('rejects invalid level', () => {
      const r = Level.create('UNIVERSITARIO');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid pedagogical level');
    });

    it('rejects empty string', () => {
      const r = Level.create('');
      expect(r.isErr()).toBe(true);
    });

    it('lists valid options in error message', () => {
      const r = Level.create('INVALIDO');
      const msg = r.unwrapErr().message;
      expect(msg).toContain('INICIAL');
      expect(msg).toContain('PRIMARIO');
      expect(msg).toContain('SECUNDARIO');
      expect(msg).toContain('TERCIARIO');
    });
  });

  describe('equals()', () => {
    it('equals same level', () => {
      const a = Level.reconstruct(LevelType.PRIMARIO);
      const b = Level.reconstruct(LevelType.PRIMARIO);
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different level', () => {
      const a = Level.reconstruct(LevelType.INICIAL);
      const b = Level.reconstruct(LevelType.SECUNDARIO);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns the level string', () => {
      const l = Level.reconstruct(LevelType.SECUNDARIO);
      expect(l.toString()).toBe('SECUNDARIO');
    });
  });
});
