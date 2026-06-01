import { describe, it, expect } from 'vitest';
import { Cue } from '../../value-objects/cue';

describe('Cue', () => {
  it('create() returns Ok for valid alphanumeric CUE', () => {
    const result = Cue.create('ABC123');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('ABC123');
  });

  it('create() returns Ok for digits-only CUE', () => {
    const result = Cue.create('12345678');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('12345678');
  });

  it('create() converts lowercase to uppercase and trims', () => {
    const result = Cue.create('  abc999  ');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('ABC999');
  });

  it('create() returns Err for empty string', () => {
    const result = Cue.create('');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('CUE cannot be empty');
  });

  it('create() returns Err for whitespace-only string', () => {
    const result = Cue.create('   ');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for string with special characters', () => {
    const result = Cue.create('ABC-123');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for string with spaces between chars', () => {
    const result = Cue.create('AB C 123');
    expect(result.isErr()).toBe(true);
  });

  it('reconstruct() creates without validation', () => {
    const cue = Cue.reconstruct('ABC123');
    expect(cue.get()).toBe('ABC123');
  });

  it('equals() works correctly', () => {
    const a = Cue.reconstruct('ABC123');
    const b = Cue.reconstruct('ABC123');
    const c = Cue.reconstruct('XYZ999');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toString() returns the CUE value', () => {
    const cue = Cue.reconstruct('ABC123');
    expect(cue.toString()).toBe('ABC123');
  });

  // ── Max 20 char validation ──────────────────────────────────────────

  it('create() returns Ok for exactly 20 characters', () => {
    const cue20 = '1234567890ABCDEFGHIJ'; // 20 chars
    const result = Cue.create(cue20);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe(cue20);
  });

  it('create() returns Ok for shorter CUE (under 20 chars)', () => {
    const result = Cue.create('ABC123');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('ABC123');
  });

  it('create() returns Err for CUE longer than 20 characters', () => {
    const tooLong = '1234567890ABCDEFGHIJK'; // 21 chars
    const result = Cue.create(tooLong);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('20');
  });

  it('create() returns Err for CUE significantly over 20 chars', () => {
    const wayTooLong = 'A'.repeat(50);
    const result = Cue.create(wayTooLong);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('20');
  });
});
