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
  /** Locked-day map built by the use case via buildLockedDayMap(year, month).
   *  The infra layer merges this into the days JSONB using read-merge-write semantics:
   *  existing hábil entries are preserved; SAB/DOM/X keys are added or corrected. */
  days?: Record<string, string>;
}

/**
 * Enriched wrapper for a subject attendance row that includes the resolved student name.
 * The domain entity (attendance) stays ID-only — studentName is a boundary projection.
 * Spec: REQ-B3, REQ-B6.
 */
export interface EnrichedMateriaAttendance {
  attendance: AsistenciaXMateriaXAlumnoXCursoXCiclo;
  /** "Apellido, Nombre" format per Argentine administrative convention. */
  studentName: string;
}

export interface AsistenciaMateriaRepository {
  /**
   * Bulk-upsert monthly subject register rows using read-merge-write semantics.
   *
   * For each row in `rows`:
   *  - If no existing row is found (first generation): creates a new row with `days` pre-loaded
   *    from `row.days` (the locked-day map for the month).
   *  - If a row already exists (re-generation): merges `row.days` (SAB/DOM/X locked keys)
   *    into the existing days JSONB. Existing hábil entries (e.g., "1":"P") are preserved;
   *    locked keys are added or corrected. The update is skipped when the merged result
   *    equals the existing days (idempotent).
   *
   * `row.days` is the locked-day map built by the use case via buildLockedDayMap(year, month).
   * The infra layer MUST NOT re-derive this map — it receives it from the application layer.
   *
   * Returns how many rows were created vs skipped (existing, regardless of update).
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

  /**
   * Return enriched subject attendance rows (with student name) for a MateriaXCursoXCiclo + month.
   * Uses a single Prisma query with student include — no N+1 (REQ-B3).
   * Results ordered by lastName asc, firstName asc (REQ-B4).
   * Do NOT use findByScopeAndMonth when the list view needs student names.
   */
  findByScopeAndMonthEnriched(
    materiaXCursoXCicloId: string,
    year: number,
    month: number,
    studentIds?: string[],
  ): Promise<EnrichedMateriaAttendance[]>;

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
