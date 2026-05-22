import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { TenantContext } from './tenant.context';
import type { AuthenticatedUser } from './guards/auth.guard';

/**
 * TenantMiddleware — resolves the correct PrismaClient per request.
 *
 * Strategy (design.md §2):
 *   - Master-only routes (/health, /v1/auth/*, institution CRUD): use master client.
 *   - Tenant-scoped routes: extract dbName from JWT → validate active via master DB
 *     → create/cache tenant PrismaClient → store in AsyncLocalStorage.
 *
 * Applied globally in AppModule.configure().
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prismaService: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const path = req.path;

    // ── Health check — always pass through ──────────────────
    if (path === '/health' || path === '/') {
      return TenantContext.run(
        { prismaClient: null, dbName: null, institutionId: null },
        () => next(),
      );
    }

    // ── Master-only routes — no tenant DB needed ────────────
    if (this.isMasterRoute(req)) {
      return TenantContext.run(
        { prismaClient: null, dbName: null, institutionId: null },
        () => next(),
      );
    }

    // ── Tenant-scoped routes — require dbName in JWT ────────
    const user = (req as any).user as AuthenticatedUser | undefined;

    if (!user || !user.dbName) {
      throw new ForbiddenException(
        'Acceso a datos de institución no autorizado: dbName no disponible en el token',
      );
    }

    // Verify institution is active via master DB
    const masterClient = this.prismaService.getMasterClient();
    const institution = await masterClient.institution.findUnique({
      where: { dbName: user.dbName },
      select: { active: true, id: true },
    });

    if (!institution || institution.active === false) {
      throw new ForbiddenException('La institución no está activa');
    }

    // Resolve tenant PrismaClient
    const tenantClient = this.prismaService.getTenantClient(user.dbName);

    return TenantContext.run(
      {
        prismaClient: tenantClient,
        dbName: user.dbName,
        institutionId: institution.id,
      },
      () => next(),
    );
  }

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Returns true for routes that should use the master DB regardless of JWT content.
   *
   * Master routes:
   *   - Health check: /health, /
   *   - Auth endpoints: /v1/auth/*
   *   - Institution management (lives in master DB): POST/GET/DELETE /v1/institutions
   *   - Swagger docs: /docs*
   */
  private isMasterRoute(req: Request): boolean {
    const path = req.path;
    const method = req.method;

    // Auth endpoints
    if (path.startsWith('/auth')) return true;

    // Docs / swagger
    if (path.startsWith('/docs')) return true;

    // Institution CRUD (master DB)
    if (path === '/institutions' || path === '/institutions/') return true;
    if (path.startsWith('/institutions/')) {
      // POST /institutions, GET /institutions (list), DELETE /institutions/:id
      if (method === 'POST' || method === 'DELETE') return true;
      if (method === 'GET') {
        // GET /institutions (list)
        if (path.match(/^\/institutions\/?$/)) return true;
        // GET /institutions/:id (single)
        if (path.match(/^\/institutions\/[^/]+$/)) return true;
      }
    }

    return false;
  }
}
