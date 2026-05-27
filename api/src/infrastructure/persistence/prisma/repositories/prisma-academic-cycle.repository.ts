import { Injectable } from '@nestjs/common';
import { AcademicCycleRepository, AcademicCycle, Id, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface AcademicCycleRow {
  id: string;
  name: string;
  level: number;
  modality: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
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

  async findActive(level?: number): Promise<AcademicCycle[]> {
    const where: Record<string, unknown> = { active: true };
    if (level != null) where.level = level;

    const records = await this.client.academicCycle.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return records.map((r: AcademicCycleRow) =>
      AcademicCycle.reconstruct({
        id: Id.reconstruct(r.id),
        name: r.name,
        level: r.level as EducationalLevelCode,
        modality: r.modality as EducationalModalityCode,
        startDate: r.startDate,
        endDate: r.endDate,
        active: r.active,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async findById(id: string): Promise<AcademicCycle | null> {
    const r = await this.client.academicCycle.findUnique({ where: { id } });
    if (!r) return null;
    return AcademicCycle.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      level: r.level as EducationalLevelCode,
      modality: r.modality as EducationalModalityCode,
      startDate: r.startDate,
      endDate: r.endDate,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
