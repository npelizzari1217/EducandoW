import { describe, it, expect } from 'vitest';
import { ok, err } from '../result';

describe('Result', () => {
  describe('ok()', () => {
    it('creates an Ok with the value', () => {
      const r = ok(42);
      expect(r.isOk()).toBe(true);
      expect(r.isErr()).toBe(false);
      expect(r.unwrap()).toBe(42);
    });

    it('throws when calling unwrapErr on Ok', () => {
      const r = ok('hello');
      expect(() => r.unwrapErr()).toThrow();
    });

    it('works with objects', () => {
      const r = ok({ name: 'test' });
      expect(r.unwrap()).toEqual({ name: 'test' });
    });
  });

  describe('err()', () => {
    it('creates an Err with the error', () => {
      const error = new Error('something failed');
      const r = err(error);
      expect(r.isOk()).toBe(false);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBe(error);
    });

    it('throws when calling unwrap on Err', () => {
      const r = err(new Error('boom'));
      expect(() => r.unwrap()).toThrow();
    });
  });

  describe('type narrowing', () => {
    it('Ok passes isOk guard', () => {
      const r: ReturnType<typeof ok<number>> = ok(1);
      if (r.isOk()) {
        const val: number = r.unwrap();
        expect(val).toBe(1);
      }
    });

    it('Err passes isErr guard', () => {
      const r = err(new Error('nope'));
      if (r.isErr()) {
        expect(r.unwrapErr().message).toBe('nope');
      }
    });
  });
});
