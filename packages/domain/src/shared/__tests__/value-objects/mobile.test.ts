import { describe, it, expect } from 'vitest';
import { Mobile } from '../../value-objects/mobile';

describe('Mobile', () => {
  describe('create()', () => {
    it('creates a valid E.164 number', () => {
      const r = Mobile.create('+5492215551234');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('+5492215551234');
    });

    it('REQ-RYT-11-A: strips spaces, dashes, parens, dots and preserves leading +', () => {
      const r = Mobile.create('+54 9 11 1234-5678');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('+5491112345678');
    });

    it('REQ-RYT-11-A: strips parens and dots too', () => {
      const r = Mobile.create('+1 (800) 555.1234');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('+18005551234');
    });

    it('REQ-RYT-11-A: strips spaces between digits without leading +', () => {
      const r = Mobile.create('11 1234 5678');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('1112345678');
    });

    it('REQ-RYT-11-B: 8-digit minimum (exactly 8 digits) → ok', () => {
      const r = Mobile.create('12345678');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('12345678');
    });

    it('REQ-RYT-11-B: 7-digit after normalization → MOBILE_INVALID', () => {
      const r = Mobile.create('1234567');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid mobile');
    });

    it('REQ-RYT-11-B: 15-digit maximum → ok', () => {
      const r = Mobile.create('123456789012345');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('123456789012345');
    });

    it('REQ-RYT-11-B: 16-digit after normalization → MOBILE_INVALID', () => {
      const r = Mobile.create('1234567890123456');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid mobile');
    });

    it('REQ-RYT-11-B: non-numeric letters → MOBILE_INVALID', () => {
      const r = Mobile.create('abc');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid mobile');
    });

    it('REQ-RYT-11-C: empty string → error (cannot be empty)', () => {
      const r = Mobile.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot be empty');
    });

    it('REQ-RYT-11-C: whitespace-only → error (cannot be empty)', () => {
      const r = Mobile.create('   ');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot be empty');
    });
  });

  describe('reconstruct()', () => {
    it('creates a Mobile without validation', () => {
      const m = Mobile.reconstruct('+5492215551234');
      expect(m.get()).toBe('+5492215551234');
    });
  });

  describe('equals()', () => {
    it('returns true for same value', () => {
      const a = Mobile.reconstruct('+5492215551234');
      const b = Mobile.reconstruct('+5492215551234');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different values', () => {
      const a = Mobile.reconstruct('+5492215551234');
      const b = Mobile.reconstruct('+5492215559999');
      expect(a.equals(b)).toBe(false);
    });
  });
});
