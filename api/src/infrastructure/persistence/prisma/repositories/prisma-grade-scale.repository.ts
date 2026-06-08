import { Injectable } from '@nestjs/common';
import {
  GradeScale,
  GradeScaleValue,
  GradeScaleRepository,
  GradeScaleFilters,
} from '@educandow/domain';
import type {
  PrismaClient as TenantPrismaClient,
  GradeScale as PrismaGradeScale,
  GradeScaleValue as PrismaGradeScaleValue,
  GradeInternalStatus as PrismaGradeInternalStatus,
} from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type PrismaGradeScaleWithValues = PrismaGradeScale & {
  values?: PrismaGradeScaleValue[];
};

@Injectable()
export class PrismaGradeScaleRepository implements GradeScaleRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ─── GradeScale operations ────────────────────────────────

  async findById(id: string): Promise<GradeScale | null> {
    const r = await this.client.gradeScale.findUnique({
      where: { id },
      include: { values: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    return r ? this.toDomain(r) : null;
  }

  async list(filters?: GradeScaleFilters): Promise<GradeScale[]> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters?.level !== undefined) where.level = filters.level;
    if (filters?.modality !== undefined) where.modality = filters.modality;
    if (filters?.active !== undefined) where.active = filters.active;

    const rows = await this.client.gradeScale.findMany({
      where,
      include: { values: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async existsByName(level: number, modality: number, name: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { level, modality, name, deletedAt: null };
    if (excludeId) where.NOT = { id: excludeId };

    const count = await this.client.gradeScale.count({ where });
    return count > 0;
  }

  async countActiveValues(scaleId: string): Promise<number> {
    return this.client.gradeScaleValue.count({
      where: { scaleId, deletedAt: null },
    });
  }

  async save(scale: GradeScale): Promise<void> {
    const data = {
      name: scale.name,
      level: scale.level,
      modality: scale.modality,
      active: scale.active,
      deletedAt: scale.deletedAt ?? null,
    };

    await this.client.gradeScale.upsert({
      where: { id: scale.id },
      create: { id: scale.id, ...data },
      update: data,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.client.gradeScale.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  // ─── GradeScaleValue operations ───────────────────────────

  async findValueById(id: string): Promise<GradeScaleValue | null> {
    const r = await this.client.gradeScaleValue.findUnique({ where: { id } });
    return r ? this.toDomainValue(r) : null;
  }

  async saveValue(value: GradeScaleValue): Promise<void> {
    const data = {
      scaleId: value.scaleId,
      code: value.code,
      label: value.label,
      internalStatus: value.internalStatus as PrismaGradeInternalStatus,
      sortOrder: value.sortOrder,
      active: value.active,
      deletedAt: value.deletedAt ?? null,
    };

    await this.client.gradeScaleValue.upsert({
      where: { id: value.id },
      create: { id: value.id, ...data },
      update: data,
    });
  }

  async softDeleteValue(id: string): Promise<void> {
    await this.client.gradeScaleValue.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  async existsValueCode(scaleId: string, code: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { scaleId, code, deletedAt: null };
    if (excludeId) where.NOT = { id: excludeId };

    const count = await this.client.gradeScaleValue.count({ where });
    return count > 0;
  }

  // ── Private helpers ────────────────────────────────────────

  private toDomain(r: PrismaGradeScaleWithValues): GradeScale {
    return GradeScale.reconstruct({
      id: r.id,
      name: r.name,
      level: r.level,
      modality: r.modality,
      active: r.active,
      deletedAt: r.deletedAt ?? null,
      values: (r.values ?? []).map((v) => this.toDomainValue(v)),
    });
  }

  private toDomainValue(r: PrismaGradeScaleValue): GradeScaleValue {
    return GradeScaleValue.reconstruct({
      id: r.id,
      scaleId: r.scaleId,
      code: r.code,
      label: r.label,
      internalStatus: r.internalStatus as import('@educandow/domain').GradeInternalStatusValue,
      sortOrder: r.sortOrder,
      active: r.active,
      deletedAt: r.deletedAt ?? null,
    });
  }
}
