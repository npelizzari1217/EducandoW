import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Infrastructure service for AES-256-GCM encryption/decryption.
 * Used by the repository layer to encrypt smtp_pass before persistence
 * and decrypt when needed for SMTP transport.
 */
export class EncryptionService {
  /**
   * Encrypts a plaintext string with AES-256-GCM.
   * Returns hex-encoded ciphertext (iv + authTag + encrypted).
   */
  static encrypt(plaintext: string, key: Buffer): string {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be exactly ${KEY_LENGTH} bytes`);
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('hex');
  }

  /**
   * Decrypts a ciphertext (hex-encoded) back to the original plaintext.
   * Throws if the key is wrong or the ciphertext has been tampered with.
   */
  static decrypt(ciphertext: string, key: Buffer): string {
    const combined = Buffer.from(ciphertext, 'hex');

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
}
