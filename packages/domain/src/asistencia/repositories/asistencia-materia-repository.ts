/**
 * AsistenciaMateriaRepository — port for AsistenciaXMateriaXAlumnoXCursoXCiclo persistence.
 * Spec: R-7, R-35, R-37; ADR-2, ADR-3, ADR-4.
 * Tenant scoping is implicit via TenantContext.
 */
import type { AsistenciaXMateriaXAlumnoXCursoXCiclo } from '../entities/asistencia-x-materia-x-alumno-x-curso-x-ciclo';

export interface GenerateMateriaInput {
  materiaXCursoXCicloId: string;
  studentId: string;
  year: number;
  month: number;
}

export interface AsistenciaMateriaRepository {
  /**
   * Bulk-insert monthly subject register rows.
   * Uses createMany + skipDuplicates semantics (ADR-3).
   * Returns how many rows were created vs skipped.
   */
  generateMany(rows: GenerateMateriaInput[]): Promise<{ created: number; skipped: number }>;

  /**
   * Return all subject attendance rows for a MateriaXCursoXCiclo + month.
   * When studentIds is provided, results are filtered to that subset — used for
   * group-scoped views (ADR-2) without polluting the storage model.
   */
  findByScopeAndMonth(
    materiaXCursoXCicloId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo[]>;

  /** Find a single monthly subject register row; returns null if not yet generated (ADR-4). */
  findOne(
    materiaXCursoXCicloId: string,
    studentId: string,
    year: number,
    month: number,
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo | null>;

  /**
   * Merge-update a single day in an existing row's days JSON.
   * Returns the updated entity.
   */
  setDay(id: string, day: number, code: string): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo>;
}
