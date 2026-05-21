import { describe, it, expect } from 'vitest';
import { Email } from '../../value-objects/email';

describe('Email', () => {
  describe('create()', () => {
    it('creates a valid email', () => {
      const r = Email.create('user@example.com');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('user@example.com');
    });

    it('lowercases the email', () => {
      const r = Email.create('User@Example.COM');
      expect(r.unwrap().get()).toBe('user@example.com');
    });

    it('trims whitespace', () => {
      const r = Email.create('  user@example.com  ');
      expect(r.unwrap().get()).toBe('user@example.com');
    });

    it('rejects empty string', () => {
      const r = Email.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot be empty');
    });

    it('rejects invalid format', () => {
      const r = Email.create('not-an-email');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid email');
    });

    it('rejects email without domain', () => {
      const r = Email.create('user@');
      expect(r.isErr()).toBe(true);
    });

    it('rejects email without username', () => {
      const r = Email.create('@example.com');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('creates an email without validation', () => {
      const e = Email.reconstruct('any@thing.com');
      expect(e.get()).toBe('any@thing.com');
    });
  });

  describe('equals()', () => {
    it('returns true for same value', () => {
      const a = Email.reconstruct('a@b.com');
      const b = Email.reconstruct('a@b.com');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different values', () => {
      const a = Email.reconstruct('a@b.com');
      const b = Email.reconstruct('c@d.com');
      expect(a.equals(b)).toBe(false);
    });
  });
});
