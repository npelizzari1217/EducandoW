import { Injectable } from '@nestjs/common';
import type { PlanificacionCurso as PrismaPC } from '@prisma/tenant-client';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PlanificacionCurso } from '@educandow/domain';
import type { PlanificacionCursoRepository } from '@educandow/domain';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaPlanificacionCursoRepository implements PlanificacionCursoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  async create(data: {
    asignacionCursoId: string;
    nombre: string;
    periodOrdinal?: number;
    descripcion?: string;
  }): Promise<PlanificacionCurso> {
    const row = await this.client.planificacionCurso.create({
      data: {
        asignacionCursoId: data.asignacionCursoId,
        nombre: data.nombre,
        periodOrdinal: data.periodOrdinal ?? null,
        descripcion: data.descripcion ?? null,
      },
    });
    return this.toDomain(row);
  }

  async listByAsignacion(asignacionCursoId: string): Promise<PlanificacionCurso[]> {
    const rows = await this.client.planificacionCurso.findMany({
      where: { asignacionCursoId, active: true, deletedAt: null },
      orderBy: [{ periodOrdinal: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async update(id: string, data: {
    nombre?: string;
    periodOrdinal?: number | null;
    descripcion?: string | null;
  }): Promise<PlanificacionCurso> {
    const row = await this.client.planificacionCurso.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.periodOrdinal !== undefined ? { periodOrdinal: data.periodOrdinal } : {}),
        ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string): Promise<void> {
    await this.client.planificacionCurso.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private toDomain(row: PrismaPC): PlanificacionCurso {
    return PlanificacionCurso.reconstruct({
      id: row.id,
      asignacionCursoId: row.asignacionCursoId,
      nombre: row.nombre,
      periodOrdinal: row.periodOrdinal ?? undefined,
      descripcion: row.descripcion ?? undefined,
      active: row.active,
      deletedAt: row.deletedAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
