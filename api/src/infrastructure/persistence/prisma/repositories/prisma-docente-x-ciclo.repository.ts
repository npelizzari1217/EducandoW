import { Injectable } from '@nestjs/common';
import { DocenteXCiclo, DocenteXCicloRepository } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type DocenteXCicloRow = {
  id: string;
  userId: string;
  cycleId: string;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaDocenteXCicloRepository — tenant-scoped persistence (Fase 2, F2-I1).
 * Tenant isolation is automatic via TenantContext.getClient() — same pattern
 * as PrismaSubjectPeriodGradeRepository.
 */
@Injectable()
export class PrismaDocenteXCicloRepository implements DocenteXCicloRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<DocenteXCiclo | null> {
    const row = await this.client.docenteXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<DocenteXCiclo[]> {
    const rows = await this.client.docenteXCiclo.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByCycleId(cycleId: string): Promise<DocenteXCiclo[]> {
    const rows = await this.client.docenteXCiclo.findMany({
      where: { cycleId, active: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByUserAndCycle(userId: string, cycleId: string): Promise<DocenteXCiclo | null> {
    const row = await this.client.docenteXCiclo.findUnique({
      where: { userId_cycleId: { userId, cycleId } },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Upsert keyed on @@unique([userId, cycleId]).
   * Returns the persisted record (existing or newly created).
   * Idempotent — DC-S3: second call returns the same id.
   */
  async upsert(data: { userId: string; cycleId: string }): Promise<DocenteXCiclo> {
    const now = new Date();
    const row = await this.client.docenteXCiclo.upsert({
      where: { userId_cycleId: { userId: data.userId, cycleId: data.cycleId } },
      create: {
        userId: data.userId,
        cycleId: data.cycleId,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        updatedAt: now,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: DocenteXCicloRow): DocenteXCiclo {
    return DocenteXCiclo.reconstruct({
      id: row.id,
      userId: row.userId,
      cycleId: row.cycleId,
      active: row.active,
      deletedAt: row.deletedAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
