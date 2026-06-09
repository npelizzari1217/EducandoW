import { Injectable } from '@nestjs/common';
import { SubjectGradingPeriod, SubjectGradingPeriodRepository } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaSubjectGradingPeriodRepository
  implements SubjectGradingPeriodRepository
{
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findByCourseCycleAndSubject(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectGradingPeriod[]> {
    const rows = await this.client.subjectGradingPeriod.findMany({
      where: { courseCycleId, subjectId },
      orderBy: { periodOrdinal: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  // ── Snapshot (AD-5) ────────────────────────────────────────────────────────

  /**
   * Idempotent ensure-on-read. If no rows exist for (courseCycleId, subjectId),
   * copies them from GradingPeriodTemplate(level, modality).items.
   * Returns the rows (existing or newly created).
   */
  async ensureSnapshot(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectGradingPeriod[]> {
    // 1. Check for existing rows
    const existing = await this.client.subjectGradingPeriod.findMany({
      where: { courseCycleId, subjectId },
      orderBy: { periodOrdinal: 'asc' },
    });

    if (existing.length > 0) {
      return existing.map((r) => this.toDomain(r));
    }

    // 2. Look up the CourseCycle to get level + modality for template resolution
    const cc = await this.client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      include: { studyPlan: { select: { modality: true } } },
    });

    if (!cc) {
      // Cross-tenant or non-existent CC — return empty
      return [];
    }

    const level = cc.level;
    const modality = cc.studyPlan.modality;

    // 3. Find the template for this level/modality
    const template = await this.client.gradingPeriodTemplate.findFirst({
      where: { level, modality, active: true },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          select: { sortOrder: true, name: true },
        },
      },
    });

    if (!template || template.items.length === 0) {
      return [];
    }

    // 4. Build snapshot objects in-memory and bulk-insert (skipDuplicates = idempotent under concurrency)
    const snapshots = template.items.map((item) =>
      SubjectGradingPeriod.snapshotFromTemplateItem({
        courseCycleId,
        subjectId,
        sortOrder: item.sortOrder,
        name: item.name,
      }),
    );

    await this.client.subjectGradingPeriod.createMany({
      data: snapshots.map((sgp) => ({
        id: sgp.id,
        courseCycleId: sgp.courseCycleId,
        subjectId: sgp.subjectId,
        periodOrdinal: sgp.periodOrdinal,
        periodName: sgp.periodName,
      })),
      skipDuplicates: true,
    });

    return snapshots;
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  async save(period: SubjectGradingPeriod): Promise<void> {
    const data = {
      courseCycleId: period.courseCycleId,
      subjectId: period.subjectId,
      periodOrdinal: period.periodOrdinal,
      periodName: period.periodName,
    };

    await this.client.subjectGradingPeriod.upsert({
      where: {
        courseCycleId_subjectId_periodOrdinal: {
          courseCycleId: period.courseCycleId,
          subjectId: period.subjectId,
          periodOrdinal: period.periodOrdinal,
        },
      },
      create: { id: period.id, ...data },
      update: data,
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toDomain(r: {
    id: string;
    courseCycleId: string;
    subjectId: string;
    periodOrdinal: number;
    periodName: string;
  }): SubjectGradingPeriod {
    return SubjectGradingPeriod.reconstruct({
      id: r.id,
      courseCycleId: r.courseCycleId,
      subjectId: r.subjectId,
      periodOrdinal: r.periodOrdinal,
      periodName: r.periodName,
    });
  }
}
