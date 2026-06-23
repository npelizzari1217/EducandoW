/**
 * AsistenciaGeneralRepository — port for AsistenciaXAlumnoXCursoXCiclo persistence.
 * Spec: R-7, R-35, R-37; ADR-3, ADR-4.
 * Tenant scoping is implicit via TenantContext.
 */
import type { AsistenciaXAlumnoXCursoXCiclo } from '../entities/asistencia-x-alumno-x-curso-x-ciclo';

export interface GenerateGeneralInput {
  courseCycleId: string;
  studentId: string;
  year: number;
  month: number;
}

/**
 * Enriched wrapper for a general attendance row that includes the resolved student name.
 * The domain entity (attendance) stays ID-only — studentName is a boundary projection.
 * Spec: REQ-B3, REQ-B6.
 */
export interface EnrichedGeneralAttendance {
  attendance: AsistenciaXAlumnoXCursoXCiclo;
  /** "Apellido, Nombre" format per Argentine administrative convention. */
  studentName: string;
}

export interface AsistenciaGeneralRepository {
  /**
   * Bulk-insert monthly register rows.
   * Uses createMany + skipDuplicates semantics — safe to call again if rows exist (ADR-3).
   * Returns how many rows were created vs skipped.
   */
  generateMany(rows: GenerateGeneralInput[]): Promise<{ created: number; skipped: number }>;

  /**
   * Return all general attendance rows for a CourseCycle + month,
   * optionally scoped to a subset of students.
   */
  findByScopeAndMonth(
    courseCycleId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<AsistenciaXAlumnoXCursoXCiclo[]>;

  /**
   * Return enriched general attendance rows (with student name) for a CourseCycle + month.
   * Uses a single Prisma query with student include — no N+1 (REQ-B3).
   * Results ordered by lastName asc, firstName asc (REQ-B4).
   * Do NOT use findByScopeAndMonth when the list view needs student names.
   */
  findByScopeAndMonthEnriched(
    courseCycleId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<EnrichedGeneralAttendance[]>;

  /** Find a single monthly register row; returns null if not yet generated (ADR-4). */
  findOne(
    courseCycleId: string,
    studentId: string,
    year: number,
    month: number,
  ): Promise<AsistenciaXAlumnoXCursoXCiclo | null>;

  /**
   * Merge-update a single day in an existing row's days JSON.
   * Returns the updated entity.
   */
  setDay(id: string, day: number, code: string): Promise<AsistenciaXAlumnoXCursoXCiclo>;
}
