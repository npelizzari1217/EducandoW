import { Injectable } from '@nestjs/common';
import { Sala, AgeGroup, Turno, Id } from '@educandow/domain';
import type { SalaRepository, SalaFilters } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaSalaRepository implements SalaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Sala | null> {
    const record = await this.client.sala.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(filters?: SalaFilters): Promise<Sala[]> {
    const where: Record<string, unknown> = {};

    if (filters?.academicYear) where.academicYear = filters.academicYear;
    if (filters?.ageGroup !== undefined) where.ageGroup = filters.ageGroup;
    if (filters?.turno) where.turno = filters.turno;
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.active !== undefined) {
      where.active = filters.active;
    } else {
      where.active = true;
    }

    const records = await this.client.sala.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(sala: Sala): Promise<void> {
    await this.client.sala.upsert({
      where: { id: sala.id.get() },
      create: {
        id: sala.id.get(),
        name: sala.name,
        ageGroup: sala.ageGroup.get(),
        turno: sala.turno.get(),
        capacity: sala.capacity,
        teacherId: sala.teacherId ?? null,
        academicYear: sala.academicYear,
        active: sala.active,
        deletedAt: sala.deletedAt ?? null,
      },
      update: {
        name: sala.name,
        ageGroup: sala.ageGroup.get(),
        turno: sala.turno.get(),
        capacity: sala.capacity,
        teacherId: sala.teacherId ?? null,
        academicYear: sala.academicYear,
        active: sala.active,
        deletedAt: sala.deletedAt ?? null,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.client.sala.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(record: Record<string, unknown>): Sala {
    return Sala.reconstruct({
      id: Id.reconstruct(record.id as string),
      name: record.name as string,
      ageGroup: AgeGroup.reconstruct(record.ageGroup as number),
      turno: Turno.reconstruct(record.turno as string),
      capacity: record.capacity as number,
      teacherId: record.teacherId as string | undefined,
      academicYear: record.academicYear as string,
      active: record.active as boolean,
      deletedAt: record.deletedAt ? new Date(record.deletedAt as string) : undefined,
    });
  }
}
