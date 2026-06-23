import { Injectable } from '@nestjs/common';
import {
  CourseCycleRepository,
  CourseCycleFilters,
  PaginatedResult,
  CreateManyResult,
  CourseCycle,
  CourseName,
  PassingGrade,
  BimonthPeriod,
  Level,
  LevelType,
  Id,
} from '@educandow/domain';
import type { EnrolledStudent } from '@educandow/domain';
import type { Prisma, PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';
import { findEnrolledStudentsByCourseCycle } from '../queries/enrolled-students.query';

type CourseCycleRow = Prisma.CourseCycleGetPayload<Record<string, never>>;

@Injectable()
export class PrismaCourseCycleRepository implements CourseCycleRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<CourseCycle | null> {
    return this.findByUuid(id);
  }

  async findByUuid(uuid: string): Promise<CourseCycle | null> {
    const record = await this.client.courseCycle.findUnique({ where: { uuid } });
    return record ? this.toDomain(record) : null;
  }

  async findByPair(courseId: string, cycleId: string): Promise<CourseCycle | null> {
    const record = await this.client.courseCycle.findFirst({
      where: { courseId, cycleId, deletedAt: null },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(filters: CourseCycleFilters): Promise<PaginatedResult<CourseCycle>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CourseCycleWhereInput = {
      deletedAt: null,
    };

    if (filters.levelIn && filters.levelIn.length > 0) {
      if (filters.level !== undefined) {
        // Intersect: if the UI-requested level is within allowed levels, filter by that exact level.
        // If it's outside the allowed scope, return empty immediately.
        if (filters.levelIn.includes(filters.level)) {
          where.level = filters.level;
        } else {
          return { data: [], page, pageSize, total: 0 };
        }
      } else {
        where.level = { in: filters.levelIn };
      }
    } else if (filters.level !== undefined) {
      where.level = filters.level;
    }
    if (filters.cycleId !== undefined) {
      where.cycleId = filters.cycleId;
    }
    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    const [records, total] = await Promise.all([
      this.client.courseCycle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { courseName: 'asc' },
      }),
      this.client.courseCycle.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      page,
      pageSize,
      total,
    };
  }

  async save(courseCycle: CourseCycle): Promise<void> {
    const data = this.toPersistence(courseCycle);

    await this.client.courseCycle.upsert({
      where: { uuid: courseCycle.uuid },
      create: {
        ...data,
        uuid: courseCycle.uuid,
      } as Prisma.CourseCycleCreateInput,
      update: data as Prisma.CourseCycleUpdateInput,
    });
  }

  async createMany(courseCycles: CourseCycle[]): Promise<CreateManyResult> {
    const records = courseCycles.map((cc) => ({
      ...this.toPersistence(cc),
      uuid: cc.uuid,
    }));

    const result = await this.client.courseCycle.createMany({
      data: records as Prisma.CourseCycleCreateManyInput[],
      skipDuplicates: true,
    });

    return {
      created: result.count,
      skipped: courseCycles.length - result.count,
      updated: 0,
      total: courseCycles.length,
    };
  }

  async softDelete(uuid: string): Promise<void> {
    await this.client.courseCycle.update({
      where: { uuid },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Returns enrolled students for a CourseCycle.
   * Delegates to the shared infra helper to avoid duplicating the heuristic join
   * and to avoid circular DI (helper is a plain function, not a cross-module UC dep).
   */
  async findEnrolledStudents(uuid: string): Promise<EnrolledStudent[]> {
    return findEnrolledStudentsByCourseCycle(this.client, uuid);
  }

  /**
   * Returns CourseCycles whose courseId (CourseSection FK) is in the provided set.
   * Used for "por materia": SubjectAssignment.courseSectionId → CourseCycle.courseId.
   * Returns empty array immediately for an empty input (no DB query).
   */
  async findByCourseSectionIds(courseSectionIds: string[]): Promise<CourseCycle[]> {
    if (courseSectionIds.length === 0) return [];
    const records = await this.client.courseCycle.findMany({
      where: { courseId: { in: courseSectionIds }, deletedAt: null },
      orderBy: { courseName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByUuids(uuids: string[]): Promise<CourseCycle[]> {
    if (uuids.length === 0) return [];
    const records = await this.client.courseCycle.findMany({
      where: { uuid: { in: uuids }, deletedAt: null },
      orderBy: { courseName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  /**
   * Single groupBy aggregation — no N+1.
   * Empty input returns an empty Map without hitting the DB.
   * CCs with zero enrollments are absent from the Map; callers default to 0.
   */
  async countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();

    const rows = await this.client.alumnosXCursoXCiclo.groupBy({
      by: ['courseCycleId'],
      where: { courseCycleId: { in: ids } },
      _count: { studentId: true },
    });

    return new Map(rows.map((row) => [row.courseCycleId, row._count.studentId]));
  }

  /**
   * Bulk variant of findGradingContextByUuid — one query for N course cycles.
   * Joins CourseCycle → StudyPlan in a single Prisma query (no N+1).
   * Returns a Map keyed by CourseCycle UUID; UUIDs not found are absent.
   * Design §2: StudyPlan is the authoritative modality source for CourseCycle grading.
   */
  async findGradingContextsByUuids(
    uuids: string[],
  ): Promise<Map<string, { level: number; modality: number }>> {
    if (uuids.length === 0) return new Map();

    const rows = await this.client.courseCycle.findMany({
      where: { uuid: { in: uuids } },
      select: {
        uuid: true,
        studyPlan: { select: { level: true, modality: true } },
      },
    });

    const result = new Map<string, { level: number; modality: number }>();
    for (const row of rows) {
      if (row.studyPlan) {
        result.set(row.uuid, { level: row.studyPlan.level, modality: row.studyPlan.modality });
      }
    }
    return result;
  }

  /**
   * Returns the (level, modality) grading-config pair for a CourseCycle.
   * Path: CourseCycle.studyPlanId → StudyPlan.{level, modality}.
   * Design §2: StudyPlan is the authoritative modality source for CourseCycle grading.
   */
  async findGradingContextByUuid(courseCycleUuid: string): Promise<{ level: number; modality: number } | null> {
    const row = await this.client.courseCycle.findUnique({
      where: { uuid: courseCycleUuid },
      select: { studyPlanId: true },
    });
    if (!row) return null;

    const plan = await this.client.studyPlan.findUnique({
      where: { id: row.studyPlanId },
      select: { level: true, modality: true },
    });
    if (!plan) return null;

    return { level: plan.level, modality: plan.modality };
  }

  private toDomain(record: CourseCycleRow): CourseCycle {
    const courseName = CourseName.reconstruct(record.courseName);
    const passingGrade = PassingGrade.reconstruct(record.passingGrade);
    const level = Level.reconstruct(record.level as LevelType);
    const firstBimonth = record.firstBimStart && record.firstBimEnd
      ? BimonthPeriod.reconstruct(record.firstBimStart, record.firstBimEnd)
      : null;
    const secondBimonth = record.secondBimStart && record.secondBimEnd
      ? BimonthPeriod.reconstruct(record.secondBimStart, record.secondBimEnd)
      : null;
    const thirdBimonth = record.thirdBimStart && record.thirdBimEnd
      ? BimonthPeriod.reconstruct(record.thirdBimStart, record.thirdBimEnd)
      : null;
    const fourthBimonth = record.fourthBimStart && record.fourthBimEnd
      ? BimonthPeriod.reconstruct(record.fourthBimStart, record.fourthBimEnd)
      : null;

    return CourseCycle.reconstruct({
      id: Id.reconstruct(String(record.id)),
      uuid: record.uuid,
      courseId: record.courseId,
      studyPlanId: record.studyPlanId,
      cycleId: record.cycleId,
      courseName,
      level,
      active: record.active,
      passingGrade,
      promotionText: record.promotionText ?? null,
      firstBimonth,
      secondBimonth,
      thirdBimonth,
      fourthBimonth,
      activeGradingPeriod: record.activeGradingPeriod ?? null,
      createdAt: record.lastModifiedAt, // using lastModifiedAt as createdAt for now; Prisma manages both
      lastModifiedAt: record.lastModifiedAt,
      deletedAt: record.deletedAt ?? null,
    });
  }

  private toPersistence(courseCycle: CourseCycle): Record<string, unknown> {
    return {
      courseId: courseCycle.courseId,
      studyPlanId: courseCycle.studyPlanId,
      cycleId: courseCycle.cycleId,
      courseName: courseCycle.courseName.get(),
      level: courseCycle.level.toCode(),
      active: courseCycle.active,
      passingGrade: courseCycle.passingGrade.get(),
      promotionText: courseCycle.promotionText,
      firstBimStart: courseCycle.firstBimonth?.start ?? null,
      firstBimEnd: courseCycle.firstBimonth?.end ?? null,
      secondBimStart: courseCycle.secondBimonth?.start ?? null,
      secondBimEnd: courseCycle.secondBimonth?.end ?? null,
      thirdBimStart: courseCycle.thirdBimonth?.start ?? null,
      thirdBimEnd: courseCycle.thirdBimonth?.end ?? null,
      fourthBimStart: courseCycle.fourthBimonth?.start ?? null,
      fourthBimEnd: courseCycle.fourthBimonth?.end ?? null,
      activeGradingPeriod: courseCycle.activeGradingPeriod,
    };
  }
}
