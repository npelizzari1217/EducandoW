import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist the process.exit mock ───────────────────────────
const { mockExit } = vi.hoisted(() => ({
  mockExit: vi.fn(),
}));

// Mock process.exit to prevent test runner from actually exiting
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
});

// Must be AFTER the stub so bootstrap.ts sees the mocked process.exit
import {
  extractDatabaseName,
  buildMaintenanceUrl,
  validateEnv,
} from '../../scripts/bootstrap';

const VALID_32_BYTE_KEY = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 ASCII bytes
const MASTER_URL = 'postgresql://user:pass@localhost:5432/educandow_master';

const ORIGINAL_ENV = { ...process.env };

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('extractDatabaseName', () => {
  it('extracts the database name from a standard postgresql URL', () => {
    const result = extractDatabaseName(
      'postgresql://user:pass@host:5432/educandow_master',
    );
    expect(result).toBe('educandow_master');
  });

  it('extracts the database name when URL has query params', () => {
    const result = extractDatabaseName(
      'postgresql://user:pass@host:5432/educandow_master?schema=public',
    );
    expect(result).toBe('educandow_master');
  });

  it('extracts the database name when URL has no port', () => {
    const result = extractDatabaseName(
      'postgresql://user:pass@host/educandow_master',
    );
    expect(result).toBe('educandow_master');
  });

  it('throws when URL format is invalid (no database name)', () => {
    expect(() => extractDatabaseName('postgresql://user:pass@host:5432')).toThrow(
      'MASTER_DATABASE_URL',
    );
  });

  it('throws when URL does not have a path', () => {
    expect(() => extractDatabaseName('postgresql://user:pass@host:5432/')).toThrow(
      'MASTER_DATABASE_URL',
    );
  });
});

describe('buildMaintenanceUrl', () => {
  it('replaces the database name with postgres', () => {
    const result = buildMaintenanceUrl(
      'postgresql://user:pass@host:5432/educandow_master',
    );
    expect(result).toBe('postgresql://user:pass@host:5432/postgres');
  });

  it('preserves query params when building maintenance URL', () => {
    const result = buildMaintenanceUrl(
      'postgresql://user:pass@host:5432/educandow_master?schema=public',
    );
    expect(result).toBe('postgresql://user:pass@host:5432/postgres?schema=public');
  });

  it('handles URLs with special characters in credentials', () => {
    const result = buildMaintenanceUrl(
      'postgresql://user%40domain:p%40ss@host:5432/educandow_master',
    );
    expect(result).toBe('postgresql://user%40domain:p%40ss@host:5432/postgres');
  });
});

describe('validateEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set known good state
    setEnv('MASTER_DATABASE_URL', MASTER_URL);
    setEnv('ENCRYPTION_KEY', VALID_32_BYTE_KEY);
    setEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not exit when both vars are present and valid', () => {
    validateEnv();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('does not exit when NODE_ENV is production but vars are valid', () => {
    setEnv('NODE_ENV', 'production');
    validateEnv();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('exits with code 1 when MASTER_DATABASE_URL is missing', () => {
    delete process.env.MASTER_DATABASE_URL;
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when MASTER_DATABASE_URL is empty string', () => {
    setEnv('MASTER_DATABASE_URL', '');
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when ENCRYPTION_KEY is 16 bytes', () => {
    setEnv('ENCRYPTION_KEY', 'short16byteskey!');
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when ENCRYPTION_KEY is 31 bytes', () => {
    setEnv('ENCRYPTION_KEY', 'a'.repeat(31));
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when ENCRYPTION_KEY is 33 bytes', () => {
    setEnv('ENCRYPTION_KEY', 'a'.repeat(33));
    validateEnv();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('accepts ENCRYPTION_KEY that is exactly 32 bytes', () => {
    setEnv('ENCRYPTION_KEY', 'x'.repeat(32));
    validateEnv();
    expect(mockExit).not.toHaveBeenCalled();
  });
});
