import { Injectable } from '@nestjs/common';
import {
  AttendanceType,
  AttendanceTypeCode,
  AttendanceTypeRepository,
  AttendanceTypeFilters,
  AttendanceBehavior,
  AttendanceBehaviorValue,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, AttendanceType as PrismaAttendanceType } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaAttendanceTypeRepository implements AttendanceTypeRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<AttendanceType | null> {
    const r = await this.client.attendanceType.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByLevelCode(level: number, code: string): Promise<AttendanceType | null> {
    const r = await this.client.attendanceType.findFirst({
      where: { level, code, deletedAt: null },
    });
    return r ? this.toDomain(r) : null;
  }

  async list(filters?: AttendanceTypeFilters): Promise<AttendanceType[]> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters?.level !== undefined) where.level = filters.level;
    if (filters?.active !== undefined) where.active = filters.active;

    const rows = await this.client.attendanceType.findMany({
      where,
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(entity: AttendanceType): Promise<void> {
    const assignable = entity.behavior.isEligible();
    const data = {
      level: entity.level,
      code: entity.code.get(),
      description: entity.description,
      absenceValue: entity.absenceValue,
      isPresent: entity.absenceValue === 0 && assignable,
      assignable,
      behavior: entity.behavior.get(),
      isSystem: entity.isSystem,
      active: entity.active,
      deletedAt: entity.deletedAt ?? null,
    };

    await this.client.attendanceType.upsert({
      where: { id: entity.id },
      create: { id: entity.id, ...data },
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.attendanceType.delete({ where: { id } });
  }

  async existsByLevelCode(level: number, code: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { level, code, deletedAt: null };
    if (excludeId) where.NOT = { id: excludeId };

    const count = await this.client.attendanceType.count({ where });
    return count > 0;
  }

  // ── Private helpers ─────────────────────────────────────────

  private toDomain(r: PrismaAttendanceType): AttendanceType {
    return AttendanceType.reconstruct({
      id: r.id,
      code: AttendanceTypeCode.reconstruct(r.code),
      description: r.description,
      absenceValue: Number(r.absenceValue), // Decimal(4,2) → number
      level: r.level,
      behavior: AttendanceBehavior.reconstruct(r.behavior as unknown as AttendanceBehaviorValue),
      isSystem: r.isSystem,
      active: r.active,
      deletedAt: r.deletedAt ?? null,
    });
  }
}
