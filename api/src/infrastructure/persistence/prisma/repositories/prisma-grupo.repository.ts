import { Injectable } from '@nestjs/common';
import {
  GrupoXCursoXMateriaXCiclo,
  GrupoRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type GrupoRow = {
  id: string;
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaGrupoRepository — tenant-scoped persistence (Fase 3b, F3-I3).
 * A group has exactly one DocenteXCiclo (MGC-R3).
 * The @@unique([materiaXCursoXCicloId, docenteXCicloId]) at DB level prevents
 * one docente from having two groups of the same materia.
 */
@Injectable()
export class PrismaGrupoRepository implements GrupoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<GrupoXCursoXMateriaXCiclo | null> {
    const row = await this.client.grupoXCursoXMateriaXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByMateria(materiaXCursoXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByDocente(docenteXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { docenteXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findGroupsForDocente(
    docenteXCicloId: string,
    materiaXCursoXCicloId: string
  ): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { docenteXCicloId, materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(data: {
    materiaXCursoXCicloId: string;
    docenteXCicloId: string;
    name?: string;
  }): Promise<GrupoXCursoXMateriaXCiclo> {
    const now = new Date();
    const row = await this.client.grupoXCursoXMateriaXCiclo.create({
      data: {
        materiaXCursoXCicloId: data.materiaXCursoXCicloId,
        docenteXCicloId: data.docenteXCicloId,
        name: data.name ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: GrupoRow): GrupoXCursoXMateriaXCiclo {
    return GrupoXCursoXMateriaXCiclo.reconstruct({
      id: row.id,
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      docenteXCicloId: row.docenteXCicloId,
      name: row.name ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
