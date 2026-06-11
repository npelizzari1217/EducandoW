import { Injectable } from '@nestjs/common';
import {
  Ingresante,
  IngresanteRepository,
  IngresanteStatus,
  Id,
  Level,
  EducationalLevelCode,
  EducationalModalityCode,
} from '@educandow/domain';
import type { IngresanteStatusValue } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface IngresanteRow {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email?: string | null;
  birthDate?: Date | null;
  address?: string | null;
  phone?: string | null;
  cycleId?: string | null;
  level: number;
  modality: number;
  status: string;
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaIngresanteRepository implements IngresanteRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async save(ingresante: Ingresante): Promise<void> {
    await this.client.ingresante.upsert({
      where: { id: ingresante.id.get() },
      create: {
        id: ingresante.id.get(),
        firstName: ingresante.firstName,
        lastName: ingresante.lastName,
        dni: ingresante.dni,
        email: ingresante.email ?? null,
        birthDate: ingresante.birthDate ?? null,
        address: ingresante.address ?? null,
        phone: ingresante.phone ?? null,
        cycleId: ingresante.cycleId?.get() ?? null,
        level: ingresante.level.levelCode,
        modality: ingresante.level.modalityCode,
        status: ingresante.status.value,
        active: true,
        deletedAt: ingresante.deletedAt ?? null,
      },
      update: {
        firstName: ingresante.firstName,
        lastName: ingresante.lastName,
        dni: ingresante.dni,
        email: ingresante.email ?? null,
        birthDate: ingresante.birthDate ?? null,
        address: ingresante.address ?? null,
        phone: ingresante.phone ?? null,
        cycleId: ingresante.cycleId?.get() ?? null,
        level: ingresante.level.levelCode,
        modality: ingresante.level.modalityCode,
        status: ingresante.status.value,
        deletedAt: ingresante.deletedAt ?? null,
      },
    });
  }

  async findById(id: Id): Promise<Ingresante | null> {
    const record = await this.client.ingresante.findUnique({ where: { id: id.get() } });
    return record ? this.toDomain(record) : null;
  }

  async findByStatus(status: string): Promise<Ingresante[]> {
    const records = await this.client.ingresante.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<Ingresante[]> {
    const records = await this.client.ingresante.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByDni(dni: string): Promise<Ingresante | null> {
    const record = await this.client.ingresante.findFirst({
      where: { dni },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: Id): Promise<void> {
    await this.client.ingresante.delete({ where: { id: id.get() } });
  }

  private toDomain(record: IngresanteRow): Ingresante {
    return Ingresante.reconstruct({
      id: Id.reconstruct(record.id),
      firstName: record.firstName,
      lastName: record.lastName,
      dni: record.dni,
      email: record.email ?? undefined,
      birthDate: record.birthDate ?? undefined,
      address: record.address ?? undefined,
      phone: record.phone ?? undefined,
      cycleId: record.cycleId ? Id.reconstruct(record.cycleId) : undefined,
      level: Level.fromParts(
        record.level as EducationalLevelCode,
        record.modality as EducationalModalityCode,
      ),
      status: IngresanteStatus.reconstruct(record.status as IngresanteStatusValue),
      createdAt: record.createdAt,
      deletedAt: record.deletedAt ?? undefined,
    });
  }
}
