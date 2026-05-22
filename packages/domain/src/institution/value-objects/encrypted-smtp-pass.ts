import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Value Object that wraps an AES-256-GCM encrypted SMTP password.
 *
 * - encrypt(plaintext, key) → EncryptedSmtpPass (ciphertext stored internally)
 * - decrypt(key) → string (returns plaintext)
 * - reconstruct(ciphertext) → EncryptedSmtpPass (from stored ciphertext, no key needed)
 * - getEncrypted() → string (the stored ciphertext, for persistence)
 */
export class EncryptedSmtpPass {
  private constructor(private readonly ciphertext: string) {}

  /**
   * Encrypts a plaintext password with AES-256-GCM using the provided key.
   * The ciphertext includes the IV and auth tag, concatenated and encoded as hex.
   * Returns an Err if the plaintext is null/undefined.
   */
  static encrypt(plaintext: string, key: Buffer): Result<EncryptedSmtpPass, ValidationError> {
    if (plaintext === null || plaintext === undefined) {
      return err(new ValidationError('Cannot encrypt null or undefined plaintext'));
    }

    if (key.length !== KEY_LENGTH) {
      return err(new ValidationError(`Encryption key must be exactly ${KEY_LENGTH} bytes`));
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Concatenate: iv (16) + authTag (16) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return ok(new EncryptedSmtpPass(combined.toString('hex')));
  }

  /**
   * Decrypts the stored ciphertext using the provided key.
   * Throws if decryption fails (wrong key, tampered data).
   */
  decrypt(key: Buffer): string {
    const combined = Buffer.from(this.ciphertext, 'hex');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Reconstructs from a stored ciphertext string (no validation — trust the DB).
   */
  static reconstruct(ciphertext: string): EncryptedSmtpPass {
    return new EncryptedSmtpPass(ciphertext);
  }

  /**
   * Returns the stored ciphertext (hex-encoded) for persistence.
   */
  getEncrypted(): string {
    return this.ciphertext;
  }
}
