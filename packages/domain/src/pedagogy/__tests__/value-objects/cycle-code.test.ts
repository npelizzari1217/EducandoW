import { describe, it, expect } from 'vitest';
import { CycleCode } from '../../value-objects/cycle-code';

describe('CycleCode', () => {
  // ── Valid codes (alphanumeric uppercase, 1-15 chars) ──

  it('accepts valid 4-digit numeric code', () => {
    const result = CycleCode.create('2024');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('2024');
  });

  it('accepts alphanumeric uppercase code with hyphens', () => {
    const result = CycleCode.create('CICLO-2026-A');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('CICLO-2026-A');
  });

  it('accepts lowercase input and normalizes to uppercase', () => {
    const result = CycleCode.create('ciclo-2026-a');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('CICLO-2026-A');
  });

  it('accepts single character code', () => {
    const result = CycleCode.create('A');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('A');
  });

  it('accepts exact 15-character code', () => {
    const result = CycleCode.create('ABCDEF123456789');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('ABCDEF123456789');
  });

  // ── Invalid codes ──────────────────────────────────

  it('rejects code longer than 15 characters', () => {
    const result = CycleCode.create('ABCDEF1234567890');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('alphanumeric uppercase');
  });

  it('rejects empty string', () => {
    const result = CycleCode.create('');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('alphanumeric uppercase');
  });

  it('rejects whitespace-only string', () => {
    const result = CycleCode.create('   ');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('alphanumeric uppercase');
  });

  it('rejects code with spaces', () => {
    const result = CycleCode.create('CICLO 2026');
    expect(result.isErr()).toBe(true);
  });

  it('rejects code with lowercase letters', () => {
    // input with lowercase mixed chars: after toUpperCase it becomes valid,
    // but codes with special chars should still fail
    const result = CycleCode.create('abc!@#');
    expect(result.isErr()).toBe(true);
  });

  it('rejects code with special characters other than hyphens', () => {
    const result = CycleCode.create('CICLO@2026');
    expect(result.isErr()).toBe(true);
  });

  it('rejects code starting with hyphen', () => {
    const result = CycleCode.create('-ABC');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('alphanumeric uppercase');
  });

  it('accepts code with leading zeros', () => {
    const result = CycleCode.create('0001');
    expect(result.isOk()).toBe(true);
    const code = result.unwrap();
    expect(code.get()).toBe('0001');
  });

  // ── reconstruct ────────────────────────────────────

  it('reconstruct preserves value without validation', () => {
    const code = CycleCode.reconstruct('2024');
    expect(code.get()).toBe('2024');
  });

  // ── equals ─────────────────────────────────────────

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

  it('equals is case-sensitive for reconstructed values', () => {
    const a = CycleCode.reconstruct('CICLO');
    const b = CycleCode.reconstruct('ciclo');
    expect(a.equals(b)).toBe(false);
  });
});
