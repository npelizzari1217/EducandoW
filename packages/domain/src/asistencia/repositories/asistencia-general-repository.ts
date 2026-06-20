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
