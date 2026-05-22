import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../encryption.service';

const FIXED_KEY = Buffer.from('abcdefghijklmnopqrstuvwx12345678', 'utf8');

describe('EncryptionService', () => {
  it('encrypt() returns non-empty string different from plaintext', () => {
    const plaintext = 'my-secret-password';
    const ciphertext = EncryptionService.encrypt(plaintext, FIXED_KEY);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(typeof ciphertext).toBe('string');
  });

  it('decrypt() recovers original plaintext after encrypt()', () => {
    const plaintext = 'smtp-password-123';
    const ciphertext = EncryptionService.encrypt(plaintext, FIXED_KEY);
    const recovered = EncryptionService.decrypt(ciphertext, FIXED_KEY);
    expect(recovered).toBe(plaintext);
  });

  it('encrypt() produces different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'same-input';
    const c1 = EncryptionService.encrypt(plaintext, FIXED_KEY);
    const c2 = EncryptionService.encrypt(plaintext, FIXED_KEY);
    expect(c1).not.toBe(c2);
  });

  it('encrypt/decrypt roundtrip works with empty string', () => {
    const ciphertext = EncryptionService.encrypt('', FIXED_KEY);
    expect(EncryptionService.decrypt(ciphertext, FIXED_KEY)).toBe('');
  });

  it('encrypt/decrypt roundtrip works with special characters', () => {
    const plaintext = 'p@ss!#$%^&*()_+ñ';
    const ciphertext = EncryptionService.encrypt(plaintext, FIXED_KEY);
    expect(EncryptionService.decrypt(ciphertext, FIXED_KEY)).toBe(plaintext);
  });

  it('encrypt/decrypt roundtrip works with long password', () => {
    const plaintext = 'A'.repeat(1000);
    const ciphertext = EncryptionService.encrypt(plaintext, FIXED_KEY);
    expect(EncryptionService.decrypt(ciphertext, FIXED_KEY)).toBe(plaintext);
  });

  it('decrypt() throws on tampered ciphertext', () => {
    const ciphertext = EncryptionService.encrypt('secret', FIXED_KEY);
    const tampered = ciphertext.slice(0, -2) + 'XX';
    expect(() => EncryptionService.decrypt(tampered, FIXED_KEY)).toThrow();
  });

  it('decrypt() throws on wrong key', () => {
    const wrongKey = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
    const ciphertext = EncryptionService.encrypt('secret', FIXED_KEY);
    expect(() => EncryptionService.decrypt(ciphertext, wrongKey)).toThrow();
  });
});
