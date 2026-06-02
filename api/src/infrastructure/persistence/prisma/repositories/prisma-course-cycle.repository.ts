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
} from '@educandow/domain';
import type { Prisma, PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

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

    if (filters.level !== undefined) {
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

  private toDomain(record: CourseCycleRow): CourseCycle {
    const courseName = CourseName.reconstruct(record.courseName);
    const passingGrade = PassingGrade.reconstruct(record.passingGrade);
    const level = Level.reconstruct(record.level as LevelType);
    const firstBimonth = BimonthPeriod.reconstruct(record.firstBimStart, record.firstBimEnd);
    const secondBimonth = BimonthPeriod.reconstruct(record.secondBimStart, record.secondBimEnd);
    const thirdBimonth = BimonthPeriod.reconstruct(record.thirdBimStart, record.thirdBimEnd);
    const fourthBimonth = BimonthPeriod.reconstruct(record.fourthBimStart, record.fourthBimEnd);

    return CourseCycle.reconstruct({
      id: { get: () => String(record.id) } as any,
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
      firstBimStart: courseCycle.firstBimonth.start,
      firstBimEnd: courseCycle.firstBimonth.end,
      secondBimStart: courseCycle.secondBimonth.start,
      secondBimEnd: courseCycle.secondBimonth.end,
      thirdBimStart: courseCycle.thirdBimonth.start,
      thirdBimEnd: courseCycle.thirdBimonth.end,
      fourthBimStart: courseCycle.fourthBimonth.start,
      fourthBimEnd: courseCycle.fourthBimonth.end,
    };
  }
}
