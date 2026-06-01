import { describe, it, expect, beforeEach, vi } from 'vitest';

// We use dynamic imports so we can mock `pg` and `child_process` before importing the service.
const mockQuery = vi.fn();
const mockPoolEnd = vi.fn();
const mockExec = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockPoolEnd,
  })),
}));

vi.mock('child_process', () => ({
  exec: mockExec,
}));

// The service reads MASTER_DATABASE_URL at import time from process.env.
// Set it before importing.
process.env.MASTER_DATABASE_URL = 'postgresql://user:pass@localhost:5432/educandow_master';
process.env.ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxyz012345'; // 32 bytes

const { PostgresAdminService } = await import('../postgres-admin.service');

describe('PostgresAdminService', () => {
  let service: PostgresAdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PostgresAdminService();
  });

  describe('createDatabase', () => {
    it('executes CREATE DATABASE against postgres maintenance DB', async () => {
      mockQuery.mockResolvedValueOnce(undefined);

      await service.createDatabase('educandow_test123');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('CREATE DATABASE');
      expect(sql).toContain('educandow_test123');
    });

    it('throws when CREATE DATABASE fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('permission denied'));

      await expect(service.createDatabase('educandow_test123')).rejects.toThrow('permission denied');
    });
  });

  describe('dropDatabase', () => {
    it('executes DROP DATABASE against postgres maintenance DB', async () => {
      mockQuery.mockResolvedValueOnce(undefined);

      await service.dropDatabase('educandow_test123');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DROP DATABASE');
      expect(sql).toContain('educandow_test123');
    });

    it('does not throw on DROP failure (IF EXISTS handles it)', async () => {
      // DROP DATABASE IF EXISTS should not throw when DB doesn't exist
      mockQuery.mockResolvedValueOnce(undefined);

      await expect(service.dropDatabase('educandow_nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('runTenantMigrations', () => {
    it('runs prisma migrate deploy with the tenant DATABASE_URL', async () => {
      // Simulate exec callback (error, stdout, stderr)
      mockExec.mockImplementationOnce((_cmd: string, _opts: any, cb: any) => {
        cb(null, 'Migration successful', '');
      });

      await service.runTenantMigrations('educandow_test123');

      expect(mockExec).toHaveBeenCalledTimes(1);
      const cmd = mockExec.mock.calls[0][0] as string;
      expect(cmd).toContain('prisma migrate deploy');
      const opts = mockExec.mock.calls[0][1] as any;
      expect(opts.env.DATABASE_URL).toContain('educandow_test123');
    });

    it('throws when prisma migrate deploy fails', async () => {
      mockExec.mockImplementationOnce((_cmd: string, _opts: any, cb: any) => {
        cb(new Error('migration failed'), '', 'error output');
      });

      await expect(service.runTenantMigrations('educandow_test123'))
        .rejects.toThrow('Migration failed');
    });
  });
});
