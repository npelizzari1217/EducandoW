import { Injectable } from '@nestjs/common';
import {
  CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo,
  CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloRepository,
} from '@educandow/domain';
import type { GradeInternalStatusValue } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo as PrismaRow } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloRepository
  implements CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloRepository
{
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ── Queries ────────────────────────────────────────────

  async findByValuationAndPeriod(
    valuationId: string,
    periodItemId: string,
  ): Promise<CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo | null> {
    const r = await this.client.competenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.findFirst({
      where: { valuationId, periodItemId },
    });
    return r ? this.toDomain(r) : null;
  }

  async listByValuation(valuationId: string): Promise<CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo[]> {
    const rows = await this.client.competenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.findMany({
      where: { valuationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  // ── Commands ───────────────────────────────────────────

  /**
   * Upserts on the unique (valuationId, periodItemId) pair.
   */
  async save(child: CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo): Promise<void> {
    const data = {
      valuationId: child.valuationId,
      periodItemId: child.periodItemId,
      gradeScaleValueId: child.gradeScaleValueId,
      gradeCode: child.gradeCode,
      internalStatus: child.internalStatus,
      modificable: child.modificable,
      imprimible: child.imprimible,
    };

    await this.client.competenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.upsert({
      where: {
        valuationId_periodItemId: {
          valuationId: child.valuationId,
          periodItemId: child.periodItemId,
        },
      },
      create: { id: child.id, ...data },
      update: data,
    });
  }

  // ── Private helpers ────────────────────────────────────

  private toDomain(r: PrismaRow): CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo {
    return CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: r.id,
      valuationId: r.valuationId,
      periodItemId: r.periodItemId,
      gradeScaleValueId: r.gradeScaleValueId,
      gradeCode: r.gradeCode,
      internalStatus: (r.internalStatus as GradeInternalStatusValue) ?? null,
      modificable: r.modificable,
      imprimible: r.imprimible,
    });
  }
}
