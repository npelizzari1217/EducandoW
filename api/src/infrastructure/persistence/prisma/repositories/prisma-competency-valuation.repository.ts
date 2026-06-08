/**
 * PR2 slim rewrite — maps the new CompetencyValuation schema.
 * Flat period columns (valuation1–4, modificable1–4, imprimible1–4, periodActive) removed.
 * courseCycleId added; unique constraint is now (studentId, competencyId, courseCycleId).
 * PR slice 1a: adds findByCourseCycleAndStudyPlanSubject (bulk read with periodValuations include).
 */
import { Injectable } from '@nestjs/common';
import {
  CompetencyValuationRepository,
  CompetencyValuationWithPeriods,
  CompetencyPeriodValuationData,
  CompetencyValuation,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, CompetencyValuation as PrismaCompetencyValuation } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaCompetencyValuationRepo implements CompetencyValuationRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<CompetencyValuation | null> {
    const r = await this.client.competencyValuation.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByCourseCycleAndStudyPlanSubject(
    courseCycleId: string,
    studyPlanSubjectId: string,
  ): Promise<CompetencyValuationWithPeriods[]> {
    // 1. Resolve all active competencies for the given studyPlanSubject
    const competencies = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId, deletedAt: null },
      select: { id: true },
    });

    if (competencies.length === 0) return [];

    // 2. Fetch parent valuations with period children included
    const rows = await this.client.competencyValuation.findMany({
      where: {
        courseCycleId,
        competencyId: { in: competencies.map((c) => c.id) },
        deletedAt: null,
      },
      include: { periodValuations: true },
    });

    // 3. Map to read model
    return rows.map((row) => this.toReadModel(row));
  }

  async findByStudentAndStudyPlanSubject(studentId: string, studyPlanSubjectId: string): Promise<CompetencyValuation[]> {
    const competencyIds = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId, deletedAt: null },
      select: { id: true },
    });

    if (competencyIds.length === 0) return [];

    const rs = await this.client.competencyValuation.findMany({
      where: {
        studentId,
        competencyId: { in: competencyIds.map((c) => c.id) },
        deletedAt: null,
      },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(v: CompetencyValuation): Promise<void> {
    await this.client.competencyValuation.upsert({
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

  async bulkCreate(valuations: CompetencyValuation[]): Promise<void> {
    if (valuations.length === 0) return;

    await this.client.competencyValuation.createMany({
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
    await this.client.competencyValuation.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(r: PrismaCompetencyValuation): CompetencyValuation {
    return CompetencyValuation.reconstruct({
      id: Id.reconstruct(r.id),
      competencyId: r.competencyId,
      studentId: r.studentId,
      courseCycleId: r.courseCycleId,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
    });
  }

  private toReadModel(
    row: PrismaCompetencyValuation & {
      periodValuations: Array<{
        periodItemId:      string;
        gradeScaleValueId: string | null;
        gradeCode:         string | null;
        internalStatus:    string | null;
        modificable:       boolean;
        imprimible:        boolean;
      }>;
    },
  ): CompetencyValuationWithPeriods {
    return {
      valuationId:  row.id,
      studentId:    row.studentId,
      competencyId: row.competencyId,
      periodValuations: row.periodValuations.map((pv): CompetencyPeriodValuationData => ({
        periodItemId:      pv.periodItemId,
        gradeScaleValueId: pv.gradeScaleValueId,
        gradeCode:         pv.gradeCode,
        internalStatus:    pv.internalStatus as CompetencyPeriodValuationData['internalStatus'],
        modificable:       pv.modificable,
        imprimible:        pv.imprimible,
      })),
    };
  }
}
