import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock @prisma/client and @prisma/tenant-client BEFORE importing PrismaService
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

vi.mock('@prisma/tenant-client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock env config
vi.mock('../../../config/env.config', () => ({
  loadEnvConfig: vi.fn(() => ({
    masterDatabaseUrl: 'postgresql://user:pass@localhost:5432/master_db',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    corsOrigin: '*',
    bcryptRounds: 4,
    encryptionKey: '0123456789abcdef0123456789abcdef',
    databaseUrl: 'postgresql://user:pass@localhost:5432/master_db',
    port: 3000,
    nodeEnv: 'test',
  })),
}));

import { PrismaService } from '../prisma.service';
import { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

const MockMasterClient = MasterPrismaClient as unknown as Mock;
const MockTenantClient = TenantPrismaClient as unknown as Mock;

describe('PrismaService (factory)', () => {
  let service: PrismaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PrismaService();
  });

  describe('getMasterClient', () => {
    it('returns the master PrismaClient', () => {
      // First call to MasterPrismaClient constructor happens in service constructor
      expect(MockMasterClient).toHaveBeenCalledTimes(1);

      const client = service.getMasterClient();
      expect(client).toBeDefined();
      // Second call returns the same instance
      const client2 = service.getMasterClient();
      expect(client2).toBe(client);
    });

    it('always returns the same master client instance (singleton)', () => {
      const c1 = service.getMasterClient();
      const c2 = service.getMasterClient();
      expect(c1).toBe(c2);
    });
  });

  describe('getTenantClient', () => {
    it('creates a new tenant client for a given dbName', () => {
      MockTenantClient.mockClear();

      const client = service.getTenantClient('educandow_test1');
      expect(client).toBeDefined();
      expect(MockTenantClient).toHaveBeenCalledTimes(1);
    });

    it('returns the same client for the same dbName (cache)', () => {
      MockTenantClient.mockClear();

      const c1 = service.getTenantClient('educandow_cache');
      const c2 = service.getTenantClient('educandow_cache');

      expect(c1).toBe(c2);
      // Should only construct once
      expect(MockTenantClient).toHaveBeenCalledTimes(1);
    });

    it('creates different clients for different dbNames', () => {
      MockTenantClient.mockClear();

      const c1 = service.getTenantClient('educandow_a');
      const c2 = service.getTenantClient('educandow_b');

      expect(c1).not.toBe(c2);
      expect(MockTenantClient).toHaveBeenCalledTimes(2);
    });

    it('builds the correct tenant URL from master URL', () => {
      MockTenantClient.mockClear();

      service.getTenantClient('educandow_xyz');

      // The mock should have been called with a datasources config
      const callArgs = MockTenantClient.mock.calls[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.datasources).toBeDefined();
      expect(callArgs.datasources.db.url).toContain('educandow_xyz');
      expect(callArgs.datasources.db.url).not.toContain('master_db');
    });
  });

  describe('onModuleDestroy', () => {
    it('disconnects master and all cached tenant clients', async () => {
      // Create some tenant clients to populate cache
      const tc1 = service.getTenantClient('educandow_1');
      const tc2 = service.getTenantClient('educandow_2');
      const mc = service.getMasterClient();

      // Each mock client needs a $disconnect method
      const disconnectSpy1 = vi.fn().mockResolvedValue(undefined);
      const disconnectSpy2 = vi.fn().mockResolvedValue(undefined);
      const disconnectSpyMaster = vi.fn().mockResolvedValue(undefined);

      (tc1 as any).$disconnect = disconnectSpy1;
      (tc2 as any).$disconnect = disconnectSpy2;
      (mc as any).$disconnect = disconnectSpyMaster;

      await service.onModuleDestroy();

      expect(disconnectSpyMaster).toHaveBeenCalledOnce();
      expect(disconnectSpy1).toHaveBeenCalledOnce();
      expect(disconnectSpy2).toHaveBeenCalledOnce();
    });
  });
});
