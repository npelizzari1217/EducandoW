import { Injectable } from '@nestjs/common';
import { SubjectCompetencyRepository, SubjectCompetency, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, SubjectCompetency as PrismaSubjectCompetency } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaSubjectCompetencyRepo implements SubjectCompetencyRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<SubjectCompetency | null> {
    const r = await this.client.subjectCompetency.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]> {
    const rs = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId },
      orderBy: { name: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findActiveByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]> {
    const rs = await this.client.subjectCompetency.findMany({
      where: { studyPlanSubjectId, active: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByStudyPlanSubjectAndName(studyPlanSubjectId: string, name: string): Promise<SubjectCompetency | null> {
    const r = await this.client.subjectCompetency.findUnique({
      where: { studyPlanSubjectId_name: { studyPlanSubjectId, name } },
    });
    return r ? this.toDomain(r) : null;
  }

  async save(c: SubjectCompetency): Promise<void> {
    await this.client.subjectCompetency.upsert({
      where: { id: c.id.get() },
      create: {
        id: c.id.get(),
        studyPlanSubjectId: c.studyPlanSubjectId,
        name: c.name,
        active: c.active,
      },
      update: {
        name: c.name,
        active: c.active,
        deletedAt: c.deletedAt ?? undefined,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.subjectCompetency.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(r: PrismaSubjectCompetency): SubjectCompetency {
    return SubjectCompetency.reconstruct({
      id: Id.reconstruct(r.id),
      studyPlanSubjectId: r.studyPlanSubjectId,
      name: r.name,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
    });
  }
}
