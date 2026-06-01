import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvConfig } from '../env.config';

const VALID_32_BYTE_KEY = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 ASCII chars = 32 bytes
const ORIGINAL_ENV = { ...process.env };

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('loadEnvConfig — ENCRYPTION_KEY bootstrap', () => {
  beforeEach(() => {
    // Clear ENCRYPTION_KEY and force NODE_ENV to a known state
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('throws when ENCRYPTION_KEY is empty string', () => {
    setEnv('ENCRYPTION_KEY', '');
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('throws when ENCRYPTION_KEY has wrong length (16 bytes)', () => {
    setEnv('ENCRYPTION_KEY', 'short16byteskey!'); // 16 chars
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('throws when ENCRYPTION_KEY has wrong length (31 bytes)', () => {
    setEnv('ENCRYPTION_KEY', 'a'.repeat(31));
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('throws when ENCRYPTION_KEY has wrong length (33 bytes)', () => {
    setEnv('ENCRYPTION_KEY', 'a'.repeat(33));
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('passes with valid 32-byte ENCRYPTION_KEY and returns config', () => {
    setEnv('ENCRYPTION_KEY', VALID_32_BYTE_KEY);
    const config = loadEnvConfig();
    expect(config.encryptionKey).toBe(VALID_32_BYTE_KEY);
    expect(config.port).toBeGreaterThan(0);
  });

  it('validates ENCRYPTION_KEY in all environments (not only production)', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('ENCRYPTION_KEY', 'too-short');
    expect(() => loadEnvConfig()).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');
  });
});
