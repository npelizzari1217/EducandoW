/**
 * PR2 slim port — CompetenciaXMateriaXAlumnoXCursoXCicloRepository.
 * findByStudentAndCompetency removed (only served removed cycle-blind paths).
 * bulkCreate semantics updated to skipDuplicates on (studentId, competencyId, courseCycleId) triple.
 */

import type { CompetenciaXMateriaXAlumnoXCursoXCiclo } from '../entities/competency-valuation';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';

// ── Bulk read projection ────────────────────────────────────────────────────
// Used by ListBulkCompetenciasXMateriaXAlumnoXCursoXCicloUC (PR slice 1a).
// This is a read-model (query result), not a write entity.

export interface CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData {
  periodItemId:      string;
  gradeScaleValueId: string | null;
  gradeCode:         string | null;
  internalStatus:    GradeInternalStatusValue | null;
  modificable:       boolean;
  imprimible:        boolean;
}

export interface CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos {
  valuationId:      string;
  studentId:        string;
  competencyId:     string;
  /** Human-readable competency name (from SubjectCompetency.name). */
  competencyName:   string;
  /** Lazily-created period children. Empty array if none graded yet (BVR-5). */
  periodValuations: CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData[];
}

// ── Port ───────────────────────────────────────────────────────────────────

export interface CompetenciaXMateriaXAlumnoXCursoXCicloRepository {
  findById(id: string): Promise<CompetenciaXMateriaXAlumnoXCursoXCiclo | null>;
  findByStudentAndStudyPlanSubject(studentId: string, studyPlanSubjectId: string): Promise<CompetenciaXMateriaXAlumnoXCursoXCiclo[]>;
  /**
   * Bulk read: returns all parent valuations for a given (courseCycleId, studyPlanSubjectId)
   * pair, each with their period children. A parent with no graded periods returns
   * periodValuations: [] — not null (BVR-5).
   */
  findByCourseCycleAndStudyPlanSubject(
    courseCycleId:      string,
    studyPlanSubjectId: string,
  ): Promise<CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos[]>;
  save(valuation: CompetenciaXMateriaXAlumnoXCursoXCiclo): Promise<void>;
  /**
   * Batch create valuations, skipping duplicates on (studentId, competencyId, courseCycleId) triple.
   * Returns `{ count }` = rows actually inserted; callers that don't need the count
   * can safely ignore the return value.
   */
  bulkCreate(valuations: CompetenciaXMateriaXAlumnoXCursoXCiclo[]): Promise<{ count: number }>;
  delete(id: string): Promise<void>;
}
