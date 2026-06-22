import { Injectable } from '@nestjs/common';
import {
  MateriaXCursoXCiclo,
  MateriaXCursoXCicloRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type MateriaXCursoXCicloRow = {
  id: string;
  courseCycleId: string;
  subjectId: string;
  studyPlanSubjectId: string | null;
  esOptativa: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaMateriaXCursoXCicloRepository — tenant-scoped persistence (Fase 3b, F3-I1).
 * Tenant isolation is automatic via TenantContext.getClient().
 */
@Injectable()
export class PrismaMateriaXCursoXCicloRepository implements MateriaXCursoXCicloRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<MateriaXCursoXCiclo | null> {
    const row = await this.client.materiaXCursoXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCourseCycleId(courseCycleId: string): Promise<MateriaXCursoXCiclo[]> {
    const rows = await this.client.materiaXCursoXCiclo.findMany({
      where: { courseCycleId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  /**
   * Upsert many — idempotent via @@unique([courseCycleId, subjectId]).
   * Used by GenerateCourseCyclesUseCase (F3-A1). skipDuplicates preserves existing rows.
   * esOptativa is optional; callers that omit it get false (obligatoria). MGC-R7.
   */
  async upsertMany(
    data: Array<{ courseCycleId: string; subjectId: string; studyPlanSubjectId?: string; esOptativa?: boolean }>
  ): Promise<void> {
    await this.client.materiaXCursoXCiclo.createMany({
      data: data.map((d) => ({
        courseCycleId: d.courseCycleId,
        subjectId: d.subjectId,
        studyPlanSubjectId: d.studyPlanSubjectId ?? null,
        esOptativa: d.esOptativa ?? false,
      })),
      skipDuplicates: true,
    });
  }

  /** Toggle the optativa flag for a materia. Returns the updated entity. MGC-R10, D3. */
  async setEsOptativa(id: string, esOptativa: boolean): Promise<MateriaXCursoXCiclo> {
    const row = await this.client.materiaXCursoXCiclo.update({
      where: { id },
      data: { esOptativa },
    });
    return this.toDomain(row);
  }

  async updateDescription(
    id: string,
    data: { studyPlanSubjectId?: string }
  ): Promise<MateriaXCursoXCiclo> {
    const row = await this.client.materiaXCursoXCiclo.update({
      where: { id },
      data: { studyPlanSubjectId: data.studyPlanSubjectId ?? null },
    });
    return this.toDomain(row);
  }

  private toDomain(row: MateriaXCursoXCicloRow): MateriaXCursoXCiclo {
    return MateriaXCursoXCiclo.reconstruct({
      id: row.id,
      courseCycleId: row.courseCycleId,
      subjectId: row.subjectId,
      studyPlanSubjectId: row.studyPlanSubjectId ?? undefined,
      esOptativa: row.esOptativa,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
