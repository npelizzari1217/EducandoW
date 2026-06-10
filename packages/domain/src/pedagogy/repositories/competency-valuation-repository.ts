/**
 * PR2 slim port — CompetencyValuationRepository.
 * findByStudentAndCompetency removed (only served removed cycle-blind paths).
 * bulkCreate semantics updated to skipDuplicates on (studentId, competencyId, courseCycleId) triple.
 */

import type { CompetencyValuation } from '../entities/competency-valuation';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';

// ── Bulk read projection ────────────────────────────────────────────────────
// Used by ListBulkCompetencyValuationsUC (PR slice 1a).
// This is a read-model (query result), not a write entity.

export interface CompetencyPeriodValuationData {
  periodItemId:      string;
  gradeScaleValueId: string | null;
  gradeCode:         string | null;
  internalStatus:    GradeInternalStatusValue | null;
  modificable:       boolean;
  imprimible:        boolean;
}

export interface CompetencyValuationWithPeriods {
  valuationId:      string;
  studentId:        string;
  competencyId:     string;
  /** Human-readable competency name (from SubjectCompetency.name). */
  competencyName:   string;
  /** Lazily-created period children. Empty array if none graded yet (BVR-5). */
  periodValuations: CompetencyPeriodValuationData[];
}

// ── Port ───────────────────────────────────────────────────────────────────

export interface CompetencyValuationRepository {
  findById(id: string): Promise<CompetencyValuation | null>;
  findByStudentAndStudyPlanSubject(studentId: string, studyPlanSubjectId: string): Promise<CompetencyValuation[]>;
  /**
   * Bulk read: returns all parent valuations for a given (courseCycleId, studyPlanSubjectId)
   * pair, each with their period children. A parent with no graded periods returns
   * periodValuations: [] — not null (BVR-5).
   */
  findByCourseCycleAndStudyPlanSubject(
    courseCycleId:      string,
    studyPlanSubjectId: string,
  ): Promise<CompetencyValuationWithPeriods[]>;
  save(valuation: CompetencyValuation): Promise<void>;
  /** Batch create valuations, skipping duplicates on (studentId, competencyId, courseCycleId) triple */
  bulkCreate(valuations: CompetencyValuation[]): Promise<void>;
  delete(id: string): Promise<void>;
}
