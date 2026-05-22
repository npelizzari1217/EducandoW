import { describe, it, expect } from 'vitest';
import { EncryptedSmtpPass } from '../../value-objects/encrypted-smtp-pass';

const KEY = Buffer.from('abcdefghijklmnopqrstuvwx12345678', 'utf8');
const WRONG_KEY = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');

describe('EncryptedSmtpPass', () => {
  // ── encrypt / decrypt roundtrip ──────────────────────────

  it('encrypt() produces ciphertext different from plaintext', () => {
    const result = EncryptedSmtpPass.encrypt('secret-password-123', KEY);
    expect(result.isErr()).toBe(false);
    const encrypted = result.unwrap();
    expect(encrypted.getEncrypted()).not.toBe('secret-password-123');
    expect(encrypted.getEncrypted().length).toBeGreaterThan(0);
  });

  it('decrypt() recovers the original plaintext', () => {
    const plaintext = 'my-smtp-password';
    const result = EncryptedSmtpPass.encrypt(plaintext, KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    const decrypted = encrypted.decrypt(KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('decrypt() with wrong key fails', () => {
    const result = EncryptedSmtpPass.encrypt('secret', KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    expect(() => encrypted.decrypt(WRONG_KEY)).toThrow();
  });

  it('encrypt() produces different ciphertext each time (random IV)', () => {
    const result1 = EncryptedSmtpPass.encrypt('same-password', KEY);
    const result2 = EncryptedSmtpPass.encrypt('same-password', KEY);
    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);
    expect(result1.unwrap().getEncrypted()).not.toBe(result2.unwrap().getEncrypted());
  });

  it('encrypt() + decrypt() roundtrip works with special characters', () => {
    const plaintext = 'p@ssw0rd!#$%^&*()_+';
    const result = EncryptedSmtpPass.encrypt(plaintext, KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    expect(encrypted.decrypt(KEY)).toBe(plaintext);
  });

  it('encrypt() + decrypt() roundtrip works with long password', () => {
    const plaintext = 'A'.repeat(500);
    const result = EncryptedSmtpPass.encrypt(plaintext, KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    expect(encrypted.decrypt(KEY)).toBe(plaintext);
  });

  it('encrypt() + decrypt() roundtrip works with empty string', () => {
    const result = EncryptedSmtpPass.encrypt('', KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    expect(encrypted.decrypt(KEY)).toBe('');
  });

  // ── reconstruct ──────────────────────────────────────────

  it('reconstruct() creates from stored ciphertext and decrypts with correct key', () => {
    const result = EncryptedSmtpPass.encrypt('stored-password', KEY);
    expect(result.isOk()).toBe(true);
    const original = result.unwrap();
    const ciphertext = original.getEncrypted();

    const reconstructed = EncryptedSmtpPass.reconstruct(ciphertext);
    expect(reconstructed.getEncrypted()).toBe(ciphertext);
    expect(reconstructed.decrypt(KEY)).toBe('stored-password');
  });

  // ── tampered ciphertext ──────────────────────────────────

  it('decrypt() throws on tampered ciphertext', () => {
    const result = EncryptedSmtpPass.encrypt('password', KEY);
    expect(result.isOk()).toBe(true);
    const encrypted = result.unwrap();
    const ciphertext = encrypted.getEncrypted();
    // Flip a byte in the encrypted portion (after IV and authTag = 32 bytes = 64 hex chars)
    const tamperedHex = ciphertext.slice(0, 64) + '00' + ciphertext.slice(66);
    const tampered = EncryptedSmtpPass.reconstruct(tamperedHex);
    expect(() => tampered.decrypt(KEY)).toThrow();
  });

  // ── encrypt errors ───────────────────────────────────────

  it('encrypt() returns Err for undefined plaintext', () => {
    const result = EncryptedSmtpPass.encrypt(undefined as unknown as string, KEY);
    expect(result.isErr()).toBe(true);
  });

  it('encrypt() returns Err for null plaintext', () => {
    const result = EncryptedSmtpPass.encrypt(null as unknown as string, KEY);
    expect(result.isErr()).toBe(true);
  });
});
