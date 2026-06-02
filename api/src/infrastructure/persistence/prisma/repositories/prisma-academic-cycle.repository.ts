import { Injectable } from '@nestjs/common';
import {
  AcademicCycleRepository,
  AcademicCycle,
  AcademicCycleFilters,
  PaginatedResult,
  CycleCode,
  BimonthPeriod,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface AcademicCycleRow {
  id: number;
  uuid: string;
  code: string;
  name: string;
  level: number;
  modality: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  deletedAt: Date | null;
  firstBimStart: Date | null;
  firstBimEnd: Date | null;
  secondBimStart: Date | null;
  secondBimEnd: Date | null;
  thirdBimStart: Date | null;
  thirdBimEnd: Date | null;
  fourthBimStart: Date | null;
  fourthBimEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaAcademicCycleRepository implements AcademicCycleRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  // ── toDomain ──────────────────────────────────────────────

  private toDomain(r: AcademicCycleRow): AcademicCycle {
    const firstBimonth = r.firstBimStart && r.firstBimEnd
      ? BimonthPeriod.reconstruct(r.firstBimStart, r.firstBimEnd)
      : null;
    const secondBimonth = r.secondBimStart && r.secondBimEnd
      ? BimonthPeriod.reconstruct(r.secondBimStart, r.secondBimEnd)
      : null;
    const thirdBimonth = r.thirdBimStart && r.thirdBimEnd
      ? BimonthPeriod.reconstruct(r.thirdBimStart, r.thirdBimEnd)
      : null;
    const fourthBimonth = r.fourthBimStart && r.fourthBimEnd
      ? BimonthPeriod.reconstruct(r.fourthBimStart, r.fourthBimEnd)
      : null;

    return AcademicCycle.reconstruct({
      numericId: r.id,
      uuid: r.uuid,
      code: CycleCode.reconstruct(r.code),
      name: r.name,
      level: r.level,
      modality: r.modality,
      startDate: r.startDate,
      endDate: r.endDate,
      active: r.active,
      deletedAt: r.deletedAt,
      firstBimonth,
      secondBimonth,
      thirdBimonth,
      fourthBimonth,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  private toPersistence(cycle: AcademicCycle): Record<string, unknown> {
    return {
      id: cycle.numericId === 0 ? undefined : cycle.numericId,
      uuid: cycle.uuid,
      code: cycle.code.get(),
      name: cycle.name,
      level: cycle.level,
      modality: cycle.modality,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      active: cycle.active,
      deletedAt: cycle.deletedAt,
      firstBimStart: cycle.firstBimonth?.start ?? null,
      firstBimEnd: cycle.firstBimonth?.end ?? null,
      secondBimStart: cycle.secondBimonth?.start ?? null,
      secondBimEnd: cycle.secondBimonth?.end ?? null,
      thirdBimStart: cycle.thirdBimonth?.start ?? null,
      thirdBimEnd: cycle.thirdBimonth?.end ?? null,
      fourthBimStart: cycle.fourthBimonth?.start ?? null,
      fourthBimEnd: cycle.fourthBimonth?.end ?? null,
      createdAt: cycle.createdAt,
      updatedAt: new Date(),
    };
  }

  // ── Queries ────────────────────────────────────────────────

  async findById(id: number): Promise<AcademicCycle | null> {
    const r = await this.client.academicCycle.findUnique({ where: { id } });
    if (!r) return null;
    return this.toDomain(r as AcademicCycleRow);
  }

  async findByUuid(uuid: string): Promise<AcademicCycle | null> {
    const r = await this.client.academicCycle.findUnique({ where: { uuid } });
    if (!r) return null;
    return this.toDomain(r as AcademicCycleRow);
  }

  async findByCode(code: string): Promise<AcademicCycle | null> {
    const r = await this.client.academicCycle.findUnique({ where: { code } });
    if (!r) return null;
    return this.toDomain(r as AcademicCycleRow);
  }

  async findActive(level?: number): Promise<AcademicCycle[]> {
    const where: Record<string, unknown> = {
      active: true,
      deletedAt: null,
    };
    if (level != null) where.level = level;

    const records = await this.client.academicCycle.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return records.map((r) => this.toDomain(r as AcademicCycleRow));
  }

  async findAll(filters: AcademicCycleFilters): Promise<PaginatedResult<AcademicCycle>> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.level != null) where.level = filters.level;
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.code) where.code = filters.code;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.client.academicCycle.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.client.academicCycle.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toDomain(r as AcademicCycleRow)),
      page,
      pageSize,
      total,
    };
  }

  // ── Mutations ──────────────────────────────────────────────

  async save(cycle: AcademicCycle): Promise<void> {
    const data = this.toPersistence(cycle);

    if (cycle.numericId === 0) {
      // Insert — remove id to let DB autoincrement
      const { id: _id, ...insertData } = data;
      await this.client.academicCycle.create({ data: insertData as any });
    } else {
      // Update
      const { id, uuid: _uuid, createdAt: _createdAt, ...updateData } = data;
      await this.client.academicCycle.update({
        where: { id: id as number },
        data: updateData as any,
      });
    }
  }

  async softDelete(uuid: string): Promise<void> {
    await this.client.academicCycle.update({
      where: { uuid },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }
}
