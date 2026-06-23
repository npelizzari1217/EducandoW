/**
 * PrismaAsistenciaGeneralRepository — tenant-scoped persistence (SDD-4 PR-2, T-20).
 *
 * Implements AsistenciaGeneralRepository for asistenciaXAlumnoXCursoXCiclo
 * (general monthly attendance, one row per student × course-cycle × month).
 *
 * All operations use TenantContext.getClient() — never the master PrismaService.
 * ADR-1: days stored as Json (JSONB) day-map { "1":"P", "2":"A", ... }.
 * ADR-3: generateMany uses createMany + skipDuplicates (additive, never overwrites).
 */
import { Injectable } from '@nestjs/common';
import type {
  AsistenciaGeneralRepository,
  GenerateGeneralInput,
  EnrichedGeneralAttendance,
} from '@educandow/domain';
import { AsistenciaXAlumnoXCursoXCiclo, DayMap, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AsistenciaGeneralRow = {
  id: string;
  courseCycleId: string;
  studentId: string;
  year: number;
  month: number;
  days: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type AsistenciaGeneralRowWithStudent = AsistenciaGeneralRow & {
  student: { firstName: string; lastName: string };
};

@Injectable()
export class PrismaAsistenciaGeneralRepository implements AsistenciaGeneralRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  /**
   * Bulk-insert general register rows.
   * createMany + skipDuplicates → idempotent, preserves existing days (ADR-3).
   * Returns { created, skipped } counts.
   */
  async generateMany(rows: GenerateGeneralInput[]): Promise<{ created: number; skipped: number }> {
    if (rows.length === 0) return { created: 0, skipped: 0 };

    const result = await this.client.asistenciaXAlumnoXCursoXCiclo.createMany({
      data: rows.map((r) => ({
        courseCycleId: r.courseCycleId,
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
   * Return all general attendance rows for a CourseCycle + month.
   * When studentIds is provided, filter to only those students (used for group-scoped views).
   */
  async findByScopeAndMonth(
    courseCycleId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<AsistenciaXAlumnoXCursoXCiclo[]> {
    const rows = await this.client.asistenciaXAlumnoXCursoXCiclo.findMany({
      where: {
        courseCycleId,
        year,
        month,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      orderBy: { studentId: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  /**
   * Return enriched general attendance rows (with student name) for a CourseCycle + month.
   * Single Prisma query with student include — no N+1 (REQ-B3).
   * DB-side orderBy: lastName asc, firstName asc (REQ-B4).
   */
  async findByScopeAndMonthEnriched(
    courseCycleId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<EnrichedGeneralAttendance[]> {
    const rows = await this.client.asistenciaXAlumnoXCursoXCiclo.findMany({
      where: {
        courseCycleId,
        year,
        month,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    return (rows as unknown as AsistenciaGeneralRowWithStudent[]).map((r) => ({
      attendance: this.toDomain(r),
      studentName: `${r.student.lastName}, ${r.student.firstName}`,
    }));
  }

  /** Find a single row by natural key; returns null if not generated yet (ADR-4). */
  async findOne(
    courseCycleId: string,
    studentId: string,
    year: number,
    month: number,
  ): Promise<AsistenciaXAlumnoXCursoXCiclo | null> {
    const row = await this.client.asistenciaXAlumnoXCursoXCiclo.findUnique({
      where: {
        courseCycleId_studentId_year_month: { courseCycleId, studentId, year, month },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Merge-update a single day in an existing row's days JSON.
   * Uses Prisma JSON merge: read existing days, set the new key, write back.
   * Returns the updated entity.
   */
  async setDay(id: string, day: number, code: string): Promise<AsistenciaXAlumnoXCursoXCiclo> {
    // Read existing row to get current days
    const existing = await this.client.asistenciaXAlumnoXCursoXCiclo.findUniqueOrThrow({
      where: { id },
      select: { days: true },
    });

    const existingDays = this.parseDays(existing.days);
    const updatedDays = { ...existingDays, [String(day)]: code };

    const updated = await this.client.asistenciaXAlumnoXCursoXCiclo.update({
      where: { id },
      data: { days: updatedDays, updatedAt: new Date() },
    });
    return this.toDomain(updated);
  }

  private parseDays(rawDays: unknown): Record<string, string> {
    if (!rawDays || typeof rawDays !== 'object' || Array.isArray(rawDays)) return {};
    return rawDays as Record<string, string>;
  }

  private toDomain(row: AsistenciaGeneralRow): AsistenciaXAlumnoXCursoXCiclo {
    return AsistenciaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(row.id),
      courseCycleId: row.courseCycleId,
      studentId: row.studentId,
      year: row.year,
      month: row.month,
      days: DayMap.fromRecord(this.parseDays(row.days)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
