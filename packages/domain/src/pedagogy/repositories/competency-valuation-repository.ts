import type { CompetencyValuation } from '../entities/competency-valuation';

export interface CompetencyValuationRepository {
  findById(id: string): Promise<CompetencyValuation | null>;
  findByStudentAndSubject(studentId: string, subjectId: string): Promise<CompetencyValuation[]>;
  findByStudentAndCompetency(studentId: string, competencyId: string): Promise<CompetencyValuation | null>;
  save(valuation: CompetencyValuation): Promise<void>;
  /** Batch create valuations, skipping duplicates on (studentId, competencyId) */
  bulkCreate(valuations: CompetencyValuation[]): Promise<void>;
  delete(id: string): Promise<void>;
}
