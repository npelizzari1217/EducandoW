import { Injectable } from '@nestjs/common';
import { Planificacion, Id } from '@educandow/domain';
import type { PlanificacionRepository, PlanificacionFilters, SecuenciaDidacticaProps } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaPlanificacionRepository implements PlanificacionRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Planificacion | null> {
    const record = await this.client.planificacion.findUnique({
      where: { id },
      include: { secuencias: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(filters?: PlanificacionFilters): Promise<Planificacion[]> {
    const where: Record<string, unknown> = {};

    if (filters?.salaId) where.salaId = filters.salaId;
    if (filters?.semana !== undefined) where.semana = filters.semana;
    if (filters?.academicYear) where.academicYear = filters.academicYear;
    if (filters?.active !== undefined) {
      where.active = filters.active;
    } else {
      where.active = true;
    }

    const records = await this.client.planificacion.findMany({
      where,
      include: { secuencias: true },
      orderBy: [{ academicYear: 'desc' }, { semana: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(planificacion: Planificacion): Promise<void> {
    await this.client.planificacion.upsert({
      where: { id: planificacion.id.get() },
      create: {
        id: planificacion.id.get(),
        salaId: planificacion.salaId,
        semana: planificacion.semana,
        academicYear: planificacion.academicYear,
        active: planificacion.active,
        deletedAt: planificacion.deletedAt ?? null,
      },
      update: {
        semana: planificacion.semana,
        academicYear: planificacion.academicYear,
        active: planificacion.active,
        deletedAt: planificacion.deletedAt ?? null,
      },
    });

    // Sync secuencias: delete and recreate
    await this.client.secuenciaDidactica.deleteMany({ where: { planificacionId: planificacion.id.get() } });
    for (const seq of planificacion.secuencias) {
      await this.client.secuenciaDidactica.create({
        data: {
          planificacionId: planificacion.id.get(),
          nombre: seq.nombre,
          area: seq.area,
          actividades: seq.actividades,
          recursos: seq.recursos,
        },
      });
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.client.planificacion.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(record: Record<string, unknown>): Planificacion {
    const secuencias = (record.secuencias as Record<string, unknown>[] | undefined) ?? [];

    return Planificacion.reconstruct({
      id: Id.reconstruct(record.id as string),
      salaId: record.salaId as string,
      semana: record.semana as number,
      academicYear: record.academicYear as string,
      active: record.active as boolean,
      deletedAt: record.deletedAt ? new Date(record.deletedAt as string) : undefined,
      secuencias: secuencias.map((s) => ({
        id: s.id as string,
        planificacionId: s.planificacionId as string,
        nombre: s.nombre as string,
        area: s.area as string,
        actividades: s.actividades as string[],
        recursos: s.recursos as string[],
      } satisfies SecuenciaDidacticaProps)),
    });
  }
}
