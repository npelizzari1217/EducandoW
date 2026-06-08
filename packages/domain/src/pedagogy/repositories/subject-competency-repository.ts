import type { SubjectCompetency } from '../entities/subject-competency';

export interface SubjectCompetencyRepository {
  findById(id: string): Promise<SubjectCompetency | null>;
  findActiveByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]>;
  findByStudyPlanSubjectAndName(studyPlanSubjectId: string, name: string): Promise<SubjectCompetency | null>;
  findByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]>;
  save(competency: SubjectCompetency): Promise<void>;
  delete(id: string): Promise<void>;
}
