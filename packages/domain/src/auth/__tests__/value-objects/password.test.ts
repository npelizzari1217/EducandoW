import { describe, it, expect } from 'vitest';
import { Password } from '../../value-objects/password';

describe('Password', () => {
  it('creates a valid password', () => {
    const result = Password.create('secret123');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('secret123');
  });

  it('rejects password shorter than 6 chars', () => {
    const result = Password.create('12345');
    expect(result.isErr()).toBe(true);
  });

  it('rejects password longer than 128 chars', () => {
    const result = Password.create('a'.repeat(129));
    expect(result.isErr()).toBe(true);
  });

  it('accepts exactly 6 chars', () => {
    const result = Password.create('123456');
    expect(result.isOk()).toBe(true);
  });

  it('accepts exactly 128 chars', () => {
    const result = Password.create('a'.repeat(128));
    expect(result.isOk()).toBe(true);
  });

  it('reconstruct restores the value', () => {
    const pw = Password.reconstruct('hashed-value');
    expect(pw.get()).toBe('hashed-value');
  });
});
