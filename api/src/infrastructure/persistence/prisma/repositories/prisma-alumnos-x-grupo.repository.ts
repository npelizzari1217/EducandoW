import { Injectable } from '@nestjs/common';
import {
  AlumnosXGrupoXCursoXMateriaXCiclo,
  AlumnosXGrupoRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AlumnosXGrupoRow = {
  id: string;
  grupoId: string;
  alumnosXMateriaXCursoXCicloId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaAlumnosXGrupoRepository — tenant-scoped persistence (Fase 3b, F3-I4).
 *
 * The FK chain enforces grupo ⊆ materia at the DB level (MGC-R4):
 *   AlumnosXGrupo.alumnosXMateriaXCursoXCicloId → AlumnosXMateria.id
 *
 * Co-docencia (MGC-R5 / MGC-S12): same alumnosXMateriaId in multiple grupos is valid
 * because @@unique is on (grupoId, alumnosXMateriaId) — cross-grupo overlap is allowed.
 */
@Injectable()
export class PrismaAlumnosXGrupoRepository implements AlumnosXGrupoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findByGrupo(grupoId: string): Promise<AlumnosXGrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.findMany({
      where: { grupoId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  /**
   * Add a student to a group via their materia membership.
   * Returns the existing record if already a member (idempotent).
   */
  async addStudent(
    grupoId: string,
    alumnosXMateriaXCursoXCicloId: string
  ): Promise<AlumnosXGrupoXCursoXMateriaXCiclo> {
    const now = new Date();
    const row = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.upsert({
      where: {
        grupoId_alumnosXMateriaXCursoXCicloId: {
          grupoId,
          alumnosXMateriaXCursoXCicloId,
        },
      },
      create: { grupoId, alumnosXMateriaXCursoXCicloId, createdAt: now, updatedAt: now },
      update: { updatedAt: now },
    });
    return this.toDomain(row);
  }

  async isMember(grupoId: string, alumnosXMateriaXCursoXCicloId: string): Promise<boolean> {
    const count = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.count({
      where: { grupoId, alumnosXMateriaXCursoXCicloId },
    });
    return count > 0;
  }

  /**
   * Bulk-upsert for backfill (skipDuplicates).
   */
  async upsertMany(
    data: Array<{ grupoId: string; alumnosXMateriaXCursoXCicloId: string }>
  ): Promise<void> {
    await this.client.alumnosXGrupoXCursoXMateriaXCiclo.createMany({
      data: data.map((d) => ({
        grupoId: d.grupoId,
        alumnosXMateriaXCursoXCicloId: d.alumnosXMateriaXCursoXCicloId,
      })),
      skipDuplicates: true,
    });
  }

  private toDomain(row: AlumnosXGrupoRow): AlumnosXGrupoXCursoXMateriaXCiclo {
    return AlumnosXGrupoXCursoXMateriaXCiclo.reconstruct({
      id: row.id,
      grupoId: row.grupoId,
      alumnosXMateriaXCursoXCicloId: row.alumnosXMateriaXCursoXCicloId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
