/**
 * PrismaAsistenciaMateriaRepository — tenant-scoped persistence (SDD-4 PR-2, T-21).
 *
 * Implements AsistenciaMateriaRepository for asistenciaXMateriaXAlumnoXCursoXCiclo
 * (per-materia monthly attendance, one row per student × materia × month).
 *
 * Group is NOT stored here — it is a filter at the query/authorization layer only (ADR-2).
 * All operations use TenantContext.getClient() — never the master PrismaService.
 * ADR-1: days stored as Json (JSONB) day-map.
 * ADR-3 (revised): generateMany uses read-merge-write transactional semantics.
 *   Natural key uses materiaXCursoXCicloId (not courseCycleId).
 */
import { Injectable } from '@nestjs/common';
import type {
  AsistenciaMateriaRepository,
  GenerateMateriaInput,
  EnrichedMateriaAttendance,
} from '@educandow/domain';
import { AsistenciaXMateriaXAlumnoXCursoXCiclo, DayMap, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Module-local pure helpers (exported for testability, @internal) ───────────

/**
 * Merge existing days JSONB with a locked-day map.
 * lockedMap contains ONLY weekend and non-existent day keys (SAB/DOM/X) — never hábil days.
 * @internal exported for testability only
 */
export function mergeLocked(
  existing: Record<string, string>,
  locked?: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...(locked ?? {}) };
}

/**
 * Returns true when the two day-maps differ (key count or any value differs).
 * Comparison is order-independent (sorts keys).
 * @internal exported for testability only
 */
export function daysChanged(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return true;
  return aKeys.some((k, i) => k !== bKeys[i] || a[k] !== b[k]);
}

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

type AsistenciaMateriaRowWithStudent = AsistenciaMateriaRow & {
  student: { firstName: string; lastName: string };
};

@Injectable()
export class PrismaAsistenciaMateriaRepository implements AsistenciaMateriaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  /**
   * Bulk-insert or merge-update subject attendance rows for a MateriaXCursoXCiclo + month.
   *
   * Read-merge-write transactional algorithm (ADR-3 revised, natural key: materiaXCursoXCicloId):
   *  1. findMany existing rows for (materiaXCursoXCicloId, year, month, studentId IN [...])
   *  2. Partition: toCreate (no existing row) / toUpdate (existing row found)
   *  3. $transaction:
   *     - createMany(toCreate, skipDuplicates:true) — new students get full locked map
   *     - for each toUpdate: mergeLocked(existing.days, r.days), update only if changed
   *
   * `days` in each input row is the locked-day map built by the use case (buildLockedDayMap).
   * Returns { created, skipped } where skipped = rows that already existed.
   */
  async generateMany(rows: GenerateMateriaInput[]): Promise<{ created: number; skipped: number }> {
    if (rows.length === 0) return { created: 0, skipped: 0 };

    const { materiaXCursoXCicloId, year, month } = rows[0];

    // 1. One read to fetch all existing rows in scope+month for the requested students
    const existing = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany({
      where: {
        materiaXCursoXCicloId,
        year,
        month,
        studentId: { in: rows.map((r) => r.studentId) },
      },
      select: { id: true, studentId: true, days: true },
    });

    const existingByStudent = new Map(
      existing.map((r) => [r.studentId, { id: r.id, days: this.parseDays(r.days) }]),
    );

    // 2. Partition
    const toCreate = rows.filter((r) => !existingByStudent.has(r.studentId));
    const toUpdate = rows.filter((r) => existingByStudent.has(r.studentId));

    // 3. Transactional write
    await this.client.$transaction(async (tx) => {
      if (toCreate.length > 0) {
        await tx.asistenciaXMateriaXAlumnoXCursoXCiclo.createMany({
          data: toCreate.map((r) => ({
            materiaXCursoXCicloId: r.materiaXCursoXCicloId,
            studentId: r.studentId,
            year: r.year,
            month: r.month,
            days: r.days ?? {},
            updatedAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }
      for (const r of toUpdate) {
        const cur = existingByStudent.get(r.studentId)!;
        const merged = mergeLocked(cur.days, r.days);
        if (daysChanged(cur.days, merged)) {
          await tx.asistenciaXMateriaXAlumnoXCursoXCiclo.update({
            where: { id: cur.id },
            data: { days: merged, updatedAt: new Date() },
          });
        }
      }
    });

    return { created: toCreate.length, skipped: toUpdate.length };
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

  /**
   * Return enriched subject attendance rows (with student name) for a MateriaXCursoXCiclo + month.
   * Single Prisma query with student include — no N+1 (REQ-B3).
   * DB-side orderBy: lastName asc, firstName asc (REQ-B4).
   */
  async findByScopeAndMonthEnriched(
    materiaXCursoXCicloId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<EnrichedMateriaAttendance[]> {
    const rows = await this.client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany({
      where: {
        materiaXCursoXCicloId,
        year,
        month,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    return (rows as unknown as AsistenciaMateriaRowWithStudent[]).map((r) => ({
      attendance: this.toDomain(r),
      studentName: `${r.student.lastName}, ${r.student.firstName}`,
    }));
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
