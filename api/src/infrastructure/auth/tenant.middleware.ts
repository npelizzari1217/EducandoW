import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { TenantContext } from './tenant.context';
import type { AuthenticatedUser, AuthenticatedRequest } from './guards/auth.guard';
import * as jwt from 'jsonwebtoken';
import { loadEnvConfig } from '../config/env.config';

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
    // Usamos originalUrl porque req.path se ve afectado por el global prefix
    const path = req.originalUrl || req.path;

    // ── Health check — always pass through ──────────────────
    if (path.includes('/health') || path === '/') {
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
    let user = (req as AuthenticatedRequest).user as AuthenticatedUser | undefined;

    // Si el AuthGuard aún no decodificó el JWT (middleware corre antes),
    // lo decodificamos nosotros desde el header Authorization
    if (!user) {
      const authHeader = req.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7);
          const env = loadEnvConfig();
          user = jwt.verify(token, env.jwtSecret) as AuthenticatedUser;
          (req as AuthenticatedRequest).user = user;
        } catch {
          throw new ForbiddenException('Token JWT inválido o expirado');
        }
      }
    }

    // ── ROOT bypass — super admin con institutionId en query param ────
    if (user && user.roles?.includes('ROOT')) {
      const qInstitutionId = req.query?.institutionId as string | undefined;

      if (qInstitutionId) {
        // Resolve institution from master DB and build tenant client
        const masterClient = this.prismaService.getMasterClient();
        const institution = await masterClient.institution.findUnique({
          where: { id: qInstitutionId },
          select: { active: true, id: true, dbName: true },
        });

        if (institution && institution.dbName) {
          // ROOT bypasses active check — super admin accesses all institutions
          const tenantClient = this.prismaService.getTenantClient(institution.dbName);
          return TenantContext.run(
            {
              prismaClient: tenantClient,
              dbName: institution.dbName,
              institutionId: institution.id,
            },
            () => next(),
          );
        }
      }

      // No institutionId provided (or institution not found) — this is a tenant route, must have an institution
      throw new ForbiddenException(
        'Acceso a datos de institución no autorizado: seleccioná una institución (institutionId query param)',
      );
    }

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
   *   - Auth endpoints: /auth/*
   *   - Institution management (lives in master DB): POST/GET/DELETE /institutions
   *   - Swagger docs: /docs*
   *
   * Note: paths are stripped of global prefix /v1 before matching.
   */
  private isMasterRoute(req: Request): boolean {
    // originalUrl incluye el global prefix /v1, lo removemos para comparar
    const raw = req.originalUrl || req.path;
    const path = raw.replace(/^\/v1/, '') || '/';
    const method = req.method;

    // Auth endpoints
    if (path.startsWith('/auth')) return true;

    // Docs / swagger
    if (path.startsWith('/docs')) return true;

    // Master DB entities — no tenant DB needed
    if (path.startsWith('/users')) return true;
    if (path.startsWith('/roles')) return true;
    if (path.startsWith('/modules')) return true;
    if (path.startsWith('/profiles')) return true;

    // Institution CRUD (master DB)
    if (path === '/institutions' || path === '/institutions/') return true;
    if (path.startsWith('/institutions/')) {
      if (method === 'POST' || method === 'PATCH' || method === 'DELETE') return true;
      if (method === 'GET') {
        if (path.match(/^\/institutions\/?$/)) return true;
        if (path.match(/^\/institutions\/[^/]+$/)) return true;
      }
    }

    return false;
  }
}
