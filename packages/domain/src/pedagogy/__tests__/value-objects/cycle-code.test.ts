import { describe, it, expect } from 'vitest';
import { CycleCode } from '../../value-objects/cycle-code';

describe('CycleCode', () => {
  it('accepts valid 4-digit numeric code', () => {
    const result = CycleCode.create('2024');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('2024');
  });

  it('rejects non-numeric code', () => {
    const result = CycleCode.create('20AB');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('4 numeric digits');
  });

  it('rejects code shorter than 4 digits', () => {
    const result = CycleCode.create('24');
    expect(result.isErr()).toBe(true);
  });

  it('rejects code longer than 4 digits', () => {
    const result = CycleCode.create('20240');
    expect(result.isErr()).toBe(true);
  });

  it('rejects code with spaces', () => {
    const result = CycleCode.create('20 4');
    expect(result.isErr()).toBe(true);
  });

  it('accepts code with leading zeros', () => {
    const result = CycleCode.create('0001');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('0001');
  });

  it('reconstruct preserves value without validation', () => {
    const code = CycleCode.reconstruct('2024');
    expect(code.get()).toBe('2024');
  });

  it('equals returns true for same code', () => {
    const a = CycleCode.reconstruct('2024');
    const b = CycleCode.reconstruct('2024');
    expect(a.equals(b)).toBe(true);
  });

  it('equals returns false for different code', () => {
    const a = CycleCode.reconstruct('2024');
    const b = CycleCode.reconstruct('2025');
    expect(a.equals(b)).toBe(false);
  });
});
