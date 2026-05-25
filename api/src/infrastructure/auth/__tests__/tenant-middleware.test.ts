import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TenantMiddleware } from '../tenant.middleware';
import type { PrismaService } from '../../persistence/prisma/prisma.service';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let mockPrismaService: any;
  let mockMasterClient: any;

  beforeEach(() => {
    mockMasterClient = {
      institution: {
        findUnique: vi.fn(),
      },
    };

    mockPrismaService = {
      getMasterClient: vi.fn(() => mockMasterClient),
      getTenantClient: vi.fn(() => ({})),
    };

    middleware = new TenantMiddleware(mockPrismaService as PrismaService);
  });

  // ── Helpers ──────────────────────────────────────────
  function mockReq(path: string, method = 'GET', user?: any) {
    return {
      path,
      method,
      user,
    } as any;
  }

  function mockRes() {
    return {} as any;
  }

  function mockNext() {
    return vi.fn();
  }

  describe('health check and root', () => {
    it('passes through /health without JWT', async () => {
      const req = mockReq('/health');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through / (root) without JWT', async () => {
      const req = mockReq('/');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('master-only routes', () => {
    it('passes through POST /institutions without JWT (AuthGuard handles auth)', async () => {
      const req = mockReq('/institutions', 'POST');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
      // GET /institutions (list) is also master
    });

    it('passes through GET /institutions (list)', async () => {
      const req = mockReq('/institutions', 'GET');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through GET /institutions/:id', async () => {
      const req = mockReq('/institutions/abc-123', 'GET');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through DELETE /institutions/:id', async () => {
      const req = mockReq('/institutions/abc-123', 'DELETE');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through auth routes', async () => {
      const req = mockReq('/auth/login', 'POST');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('passes through docs routes', async () => {
      const req = mockReq('/docs', 'GET');
      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('tenant-scoped routes', () => {
    it('throws 403 when JWT has no dbName', async () => {
      const req = mockReq('/students', 'GET', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-1',
        dbName: null,
      });

      await expect(
        middleware.use(req, mockRes(), mockNext()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when user is not set', async () => {
      const req = mockReq('/students', 'GET'); // no user

      await expect(
        middleware.use(req, mockRes(), mockNext()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when institution is inactive', async () => {
      mockMasterClient.institution.findUnique.mockResolvedValue({
        active: false,
        id: 'inst-1',
      });

      const req = mockReq('/students', 'GET', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-1',
        dbName: 'educandow_inactive',
      });

      await expect(
        middleware.use(req, mockRes(), mockNext()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when institution not found in master DB', async () => {
      mockMasterClient.institution.findUnique.mockResolvedValue(null);

      const req = mockReq('/students', 'GET', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-1',
        dbName: 'educandow_missing',
      });

      await expect(
        middleware.use(req, mockRes(), mockNext()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets tenant client and passes through when institution is active', async () => {
      mockMasterClient.institution.findUnique.mockResolvedValue({
        active: true,
        id: 'inst-active',
      });

      const tenantClient = { student: { findMany: vi.fn() } };
      mockPrismaService.getTenantClient.mockReturnValue(tenantClient);

      const req = mockReq('/students', 'GET', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-active',
        dbName: 'educandow_active',
      });

      const next = mockNext();

      await middleware.use(req, mockRes(), next);

      expect(mockPrismaService.getMasterClient).toHaveBeenCalled();
      expect(mockMasterClient.institution.findUnique).toHaveBeenCalledWith({
        where: { dbName: 'educandow_active' },
        select: { active: true, id: true },
      });
      expect(mockPrismaService.getTenantClient).toHaveBeenCalledWith('educandow_active');
      expect(next).toHaveBeenCalledOnce();
    });

    it('does not call getTenantClient when institution is inactive (early 403)', async () => {
      mockMasterClient.institution.findUnique.mockResolvedValue({
        active: false,
        id: 'inst-1',
      });

      const req = mockReq('/teachers', 'GET', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-1',
        dbName: 'educandow_dead',
      });

      await expect(
        middleware.use(req, mockRes(), mockNext()),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.getTenantClient).not.toHaveBeenCalled();
    });
  });

  describe('tenant-scoped non-GET routes', () => {
    it('routes POST to /students through tenant middleware', async () => {
      mockMasterClient.institution.findUnique.mockResolvedValue({
        active: true,
        id: 'inst-post',
      });

      const req = mockReq('/students', 'POST', {
        userId: 'u1',
        roles: ['ADMIN'],
        institutionId: 'inst-post',
        dbName: 'educandow_post',
      });

      const next = mockNext();

      await middleware.use(req, mockRes(), next);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
