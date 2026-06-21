import { Injectable } from '@nestjs/common';
import { InformeEvolutivo, Periodo, Id } from '@educandow/domain';
import type { InformeRepository, InformeFilters, AreaDesarrolloProps } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaInformeRepository implements InformeRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<InformeEvolutivo | null> {
    const record = await this.client.informeEvolutivo.findUnique({
      where: { id },
      include: { areas: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(filters?: InformeFilters): Promise<InformeEvolutivo[]> {
    const where: Record<string, unknown> = { active: true };

    if (filters?.salaId) where.salaId = filters.salaId;
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.periodo) where.periodo = filters.periodo;

    const records = await this.client.informeEvolutivo.findMany({
      where,
      include: { areas: true },
      orderBy: { fecha: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(informe: InformeEvolutivo): Promise<void> {
    await this.client.informeEvolutivo.upsert({
      where: { id: informe.id.get() },
      create: {
        id: informe.id.get(),
        studentId: informe.studentId,
        salaId: informe.salaId,
        periodo: informe.periodo.get(),
        fecha: informe.fecha,
        observacionesGenerales: informe.observacionesGenerales ?? null,
        active: true,
      },
      update: {
        periodo: informe.periodo.get(),
        fecha: informe.fecha,
        observacionesGenerales: informe.observacionesGenerales ?? null,
      },
    });

    // Sync areas: delete and recreate
    await this.client.areaDesarrollo.deleteMany({ where: { informeId: informe.id.get() } });
    for (const area of informe.areas) {
      await this.client.areaDesarrollo.create({
        data: {
          id: area.id,
          informeId: informe.id.get(),
          area: area.area,
          observacion: area.observacion,
          valoracion: area.valoracion,
        },
      });
    }
  }

  private toDomain(record: Record<string, unknown>): InformeEvolutivo {
    const areas = (record.areas as Record<string, unknown>[] | undefined) ?? [];

    return InformeEvolutivo.reconstruct({
      id: Id.reconstruct(record.id as string),
      studentId: record.studentId as string,
      salaId: record.salaId as string,
      periodo: Periodo.reconstruct(record.periodo as string),
      fecha: new Date(record.fecha as string),
      observacionesGenerales: record.observacionesGenerales as string | undefined,
      areas: areas.map((a) => ({
        id: a.id as string,
        informeId: a.informeId as string,
        area: a.area as string,
        observacion: a.observacion as string,
        valoracion: a.valoracion as string,
      } satisfies AreaDesarrolloProps)),
    });
  }
}
