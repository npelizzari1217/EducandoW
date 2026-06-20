/**
 * PrismaAsistenciaMateriaRepository — tenant-scoped persistence (SDD-4 PR-2, T-21).
 *
 * Implements AsistenciaMateriaRepository for asistenciaXMateriaXAlumnoXCursoXCiclo
 * (per-materia monthly attendance, one row per student × materia × month).
 *
 * Group is NOT stored here — it is a filter at the query/authorization layer only (ADR-2).
 * All operations use TenantContext.getClient() — never the master PrismaService.
 * ADR-1: days stored as Json (JSONB) day-map.
 * ADR-3: generateMany uses createMany + skipDuplicates (additive, never overwrites).
 */
import { Injectable } from '@nestjs/common';
import type { AsistenciaMateriaRepository, GenerateMateriaInput } from '@educandow/domain';
import { AsistenciaXMateriaXAlumnoXCursoXCiclo, DayMap, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AsistenciaMateriaRow = {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
  year: number;
  month: number;
  days: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaAsistenciaMateriaRepository implements AsistenciaMateriaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  /**
   * Bulk-insert subject register rows.
   * createMany + skipDuplicates → idempotent, preserves existing days (ADR-3).
   * Returns { created, skipped } counts.
   */
  async generateMany(rows: GenerateMateriaInput[]): Promise<{ created: number; skipped: number }> {
    if (rows.length === 0) return { created: 0, skipped: 0 };

    const result = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.createMany({
      data: rows.map((r) => ({
        materiaXCursoXCicloId: r.materiaXCursoXCicloId,
        studentId: r.studentId,
        year: r.year,
        month: r.month,
        days: {},
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    return { created: result.count, skipped: rows.length - result.count };
  }

  /**
   * Return all subject attendance rows for a MateriaXCursoXCiclo + month.
   * When studentIds is provided, filter to only those students (group-scoped view, ADR-2).
   */
  async findByScopeAndMonth(
    materiaXCursoXCicloId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo[]> {
    const rows = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany({
      where: {
        materiaXCursoXCicloId,
        year,
        month,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      orderBy: { studentId: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  /** Find a single row by natural key; returns null if not generated yet (ADR-4). */
  async findOne(
    materiaXCursoXCicloId: string,
    studentId: string,
    year: number,
    month: number,
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo | null> {
    const row = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.findUnique({
      where: {
        materiaXCursoXCicloId_studentId_year_month: {
          materiaXCursoXCicloId,
          studentId,
          year,
          month,
        },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Merge-update a single day in an existing row's days JSON.
   * Returns the updated entity.
   */
  async setDay(id: string, day: number, code: string): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo> {
    const existing = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.findUniqueOrThrow({
      where: { id },
      select: { days: true },
    });

    const existingDays = this.parseDays(existing.days);
    const updatedDays = { ...existingDays, [String(day)]: code };

    const updated = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.update({
      where: { id },
      data: { days: updatedDays, updatedAt: new Date() },
    });
    return this.toDomain(updated);
  }

  private parseDays(rawDays: unknown): Record<string, string> {
    if (!rawDays || typeof rawDays !== 'object' || Array.isArray(rawDays)) return {};
    return rawDays as Record<string, string>;
  }

  private toDomain(row: AsistenciaMateriaRow): AsistenciaXMateriaXAlumnoXCursoXCiclo {
    return AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(row.id),
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      studentId: row.studentId,
      year: row.year,
      month: row.month,
      days: DayMap.fromRecord(this.parseDays(row.days)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
