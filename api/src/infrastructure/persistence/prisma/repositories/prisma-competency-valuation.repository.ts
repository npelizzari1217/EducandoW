import { Injectable } from '@nestjs/common';
import { CompetencyValuationRepository, CompetencyValuation, Id } from '@educandow/domain';
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

  async findByStudentAndSubject(studentId: string, subjectId: string): Promise<CompetencyValuation[]> {
    const competencyIds = await this.client.subjectCompetency.findMany({
      where: { subjectId, deletedAt: null },
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

  async findByStudentAndCompetency(studentId: string, competencyId: string): Promise<CompetencyValuation | null> {
    const r = await this.client.competencyValuation.findUnique({
      where: { studentId_competencyId: { studentId, competencyId } },
    });
    return r ? this.toDomain(r) : null;
  }

  async save(v: CompetencyValuation): Promise<void> {
    await this.client.competencyValuation.upsert({
      where: { id: v.id.get() },
      create: {
        id: v.id.get(),
        competencyId: v.competencyId,
        studentId: v.studentId,
        valuation1: v.valuation1,
        valuation2: v.valuation2,
        valuation3: v.valuation3,
        valuation4: v.valuation4,
        modificable1: v.modificable1,
        modificable2: v.modificable2,
        modificable3: v.modificable3,
        modificable4: v.modificable4,
        imprimible1: v.imprimible1,
        imprimible2: v.imprimible2,
        imprimible3: v.imprimible3,
        imprimible4: v.imprimible4,
        periodActive: v.periodActive,
      },
      update: {
        valuation1: v.valuation1,
        valuation2: v.valuation2,
        valuation3: v.valuation3,
        valuation4: v.valuation4,
        modificable1: v.modificable1,
        modificable2: v.modificable2,
        modificable3: v.modificable3,
        modificable4: v.modificable4,
        imprimible1: v.imprimible1,
        imprimible2: v.imprimible2,
        imprimible3: v.imprimible3,
        imprimible4: v.imprimible4,
        periodActive: v.periodActive,
        deletedAt: v.deletedAt ?? undefined,
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
        valuation1: v.valuation1,
        valuation2: v.valuation2,
        valuation3: v.valuation3,
        valuation4: v.valuation4,
        modificable1: v.modificable1,
        modificable2: v.modificable2,
        modificable3: v.modificable3,
        modificable4: v.modificable4,
        imprimible1: v.imprimible1,
        imprimible2: v.imprimible2,
        imprimible3: v.imprimible3,
        imprimible4: v.imprimible4,
        periodActive: v.periodActive,
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
      valuation1: r.valuation1,
      valuation2: r.valuation2,
      valuation3: r.valuation3,
      valuation4: r.valuation4,
      modificable1: r.modificable1,
      modificable2: r.modificable2,
      modificable3: r.modificable3,
      modificable4: r.modificable4,
      imprimible1: r.imprimible1,
      imprimible2: r.imprimible2,
      imprimible3: r.imprimible3,
      imprimible4: r.imprimible4,
      periodActive: r.periodActive,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
    });
  }
}
