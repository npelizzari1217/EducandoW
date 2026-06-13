import { Injectable } from '@nestjs/common';
import {
  AlumnosXGrupoXCursoXMateriaXCiclo,
  AlumnosXGrupoRepository,
  type AlumnoGrupoEnriched,
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
   * Remove a student from a group, scoped to grupoId.
   * deleteMany is idempotent (returns count=0 when not found) and prevents IDOR:
   * if alumnoXGrupoId belongs to a different grupo, where{id,grupoId} won't match.
   */
  async removeStudent(grupoId: string, id: string): Promise<void> {
    await this.client.alumnosXGrupoXCursoXMateriaXCiclo.deleteMany({
      where: { id, grupoId },
    });
  }

  /**
   * Returns alumnos of a group enriched with studentId + studentName.
   * Resolution: AlumnosXGrupo → AlumnosXMateriaXCursoXCiclo.studentId → Student name.
   * Throws if no tenant client (surfaces the error instead of silently returning []).
   */
  async findByGrupoEnriched(grupoId: string): Promise<AlumnoGrupoEnriched[]> {
    const axgRows = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.findMany({
      where: { grupoId },
      orderBy: { createdAt: 'asc' },
    });
    if (axgRows.length === 0) return [];

    const axmIds = axgRows.map((r: { alumnosXMateriaXCursoXCicloId: string }) => r.alumnosXMateriaXCursoXCicloId);
    const axmRows = await this.client.alumnosXMateriaXCursoXCiclo.findMany({
      where: { id: { in: axmIds } },
      select: { id: true, studentId: true },
    });
    const axmToStudentId = new Map<string, string>(
      axmRows.map((r: { id: string; studentId: string }) => [r.id, r.studentId]),
    );

    const studentIds = [...new Set(axmToStudentId.values())];
    const students = await this.client.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const studentNameMap = new Map<string, string>(
      students.map((s: { id: string; firstName: string; lastName: string }) => [
        s.id,
        `${s.firstName} ${s.lastName}`.trim(),
      ]),
    );

    return axgRows.map((a: { id: string; alumnosXMateriaXCursoXCicloId: string }) => {
      const studentId = axmToStudentId.get(a.alumnosXMateriaXCursoXCicloId) ?? '';
      return {
        id: a.id,
        studentId,
        studentName: studentNameMap.get(studentId) ?? studentId,
      };
    });
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
