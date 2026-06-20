/**
 * PR2 slim rewrite — maps the new CompetenciaXMateriaXAlumnoXCursoXCiclo schema.
 * Flat period columns (valuation1–4, modificable1–4, imprimible1–4, periodActive) removed.
 * courseCycleId added; unique constraint is now (studentId, competencyId, courseCycleId).
 * PR slice 1a: adds findByCourseCycleAndStudyPlanSubject (bulk read with periodValuations include).
 */
import { Injectable } from '@nestjs/common';
import {
  CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
  CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos,
  CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData,
  CompetenciaXMateriaXAlumnoXCursoXCiclo,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, CompetenciaXMateriaXAlumnoXCursoXCiclo as PrismaCompetenciaXMateriaXAlumnoXCursoXCiclo } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo implements CompetenciaXMateriaXAlumnoXCursoXCicloRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<CompetenciaXMateriaXAlumnoXCursoXCiclo | null> {
    const r = await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByCourseCycleAndStudyPlanSubject(
    courseCycleId: string,
    studyPlanSubjectId: string,
  ): Promise<CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos[]> {
    // 1. Resolve all active competencies with their human-readable names
    const competencies = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (competencies.length === 0) return [];

    // Build name lookup: competencyId → name (single query, no N+1)
    const nameById = new Map(competencies.map((c) => [c.id, c.name]));

    // 2. Fetch parent valuations with period children included
    const rows = await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.findMany({
      where: {
        courseCycleId,
        competencyId: { in: competencies.map((c) => c.id) },
        deletedAt: null,
      },
      include: { periodValuations: true },
    });

    // 3. Map to read model (name resolved from the lookup built in step 1)
    return rows.map((row) => this.toReadModel(row, nameById));
  }

  async findByStudentAndStudyPlanSubject(studentId: string, studyPlanSubjectId: string): Promise<CompetenciaXMateriaXAlumnoXCursoXCiclo[]> {
    const competencyIds = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId, deletedAt: null },
      select: { id: true },
    });

    if (competencyIds.length === 0) return [];

    const rs = await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.findMany({
      where: {
        studentId,
        competencyId: { in: competencyIds.map((c) => c.id) },
        deletedAt: null,
      },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(v: CompetenciaXMateriaXAlumnoXCursoXCiclo): Promise<void> {
    await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.upsert({
      where: { id: v.id.get() },
      create: {
        id: v.id.get(),
        competencyId: v.competencyId,
        studentId: v.studentId,
        courseCycleId: v.courseCycleId,
      },
      update: {
        active: v.active,
        deletedAt: v.deletedAt ?? null,
      },
    });
  }

  async bulkCreate(valuations: CompetenciaXMateriaXAlumnoXCursoXCiclo[]): Promise<void> {
    if (valuations.length === 0) return;

    await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.createMany({
      data: valuations.map((v) => ({
        id: v.id.get(),
        competencyId: v.competencyId,
        studentId: v.studentId,
        courseCycleId: v.courseCycleId,
      })),
      skipDuplicates: true,
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.competenciaXMateriaXAlumnoXCursoXCiclo.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(r: PrismaCompetenciaXMateriaXAlumnoXCursoXCiclo): CompetenciaXMateriaXAlumnoXCursoXCiclo {
    return CompetenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(r.id),
      competencyId: r.competencyId,
      studentId: r.studentId,
      courseCycleId: r.courseCycleId,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
    });
  }

  private toReadModel(
    row: PrismaCompetenciaXMateriaXAlumnoXCursoXCiclo & {
      periodValuations: Array<{
        periodItemId:      string;
        gradeScaleValueId: string | null;
        gradeCode:         string | null;
        internalStatus:    string | null;
        modificable:       boolean;
        imprimible:        boolean;
      }>;
    },
    nameById: Map<string, string>,
  ): CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos {
    return {
      valuationId:    row.id,
      studentId:      row.studentId,
      competencyId:   row.competencyId,
      competencyName: nameById.get(row.competencyId) ?? '',
      periodValuations: row.periodValuations.map((pv): CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData => ({
        periodItemId:      pv.periodItemId,
        gradeScaleValueId: pv.gradeScaleValueId,
        gradeCode:         pv.gradeCode,
        internalStatus:    pv.internalStatus as CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData['internalStatus'],
        modificable:       pv.modificable,
        imprimible:        pv.imprimible,
      })),
    };
  }
}
