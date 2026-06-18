import { Injectable } from '@nestjs/common';
import { LlamadoExamen, LlamadoExamenRepository, RangoFechas, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface LlamadoExamenRow {
  id: string;
  nombre: string;
  anioAcademico: string;
  fechaInicio: Date;
  fechaFin: Date;
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaLlamadoExamenRepository implements LlamadoExamenRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<LlamadoExamen | null> {
    const row = await this.client.llamadoExamen.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByAnioAcademico(anioAcademico: string): Promise<LlamadoExamen[]> {
    const rows = await this.client.llamadoExamen.findMany({
      where: { anioAcademico, active: true, deletedAt: null },
      orderBy: { fechaInicio: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findOverlapping(
    anioAcademico: string,
    inicio: Date,
    fin: Date,
    excludeId?: string,
  ): Promise<LlamadoExamen[]> {
    const rows = await this.client.llamadoExamen.findMany({
      where: {
        anioAcademico,
        active: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        fechaInicio: { lte: fin },
        fechaFin: { gte: inicio },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(llamado: LlamadoExamen): Promise<void> {
    await this.client.llamadoExamen.upsert({
      where: { id: llamado.id.get() },
      create: {
        id: llamado.id.get(),
        nombre: llamado.nombre,
        anioAcademico: llamado.anioAcademico,
        fechaInicio: llamado.fechaInicio,
        fechaFin: llamado.fechaFin,
        active: llamado.active,
        deletedAt: llamado.deletedAt ?? null,
      },
      update: {
        nombre: llamado.nombre,
        anioAcademico: llamado.anioAcademico,
        fechaInicio: llamado.fechaInicio,
        fechaFin: llamado.fechaFin,
        active: llamado.active,
        deletedAt: llamado.deletedAt ?? null,
      },
    });
  }

  private toDomain(row: LlamadoExamenRow): LlamadoExamen {
    const rango = RangoFechas.create(row.fechaInicio, row.fechaFin).unwrap();
    return LlamadoExamen.reconstruct({
      id: Id.reconstruct(row.id),
      nombre: row.nombre,
      anioAcademico: row.anioAcademico,
      rango,
      active: row.active,
      deletedAt: row.deletedAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
