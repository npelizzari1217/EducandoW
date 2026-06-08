/**
 * PR2 slim port — CompetencyValuationRepository.
 * findByStudentAndCompetency removed (only served removed cycle-blind paths).
 * bulkCreate semantics updated to skipDuplicates on (studentId, competencyId, courseCycleId) triple.
 */

import type { CompetencyValuation } from '../entities/competency-valuation';

export interface CompetencyValuationRepository {
  findById(id: string): Promise<CompetencyValuation | null>;
  findByStudentAndStudyPlanSubject(studentId: string, studyPlanSubjectId: string): Promise<CompetencyValuation[]>;
  save(valuation: CompetencyValuation): Promise<void>;
  /** Batch create valuations, skipping duplicates on (studentId, competencyId, courseCycleId) triple */
  bulkCreate(valuations: CompetencyValuation[]): Promise<void>;
  delete(id: string): Promise<void>;
}
