import type { SubjectCompetency } from '../entities/subject-competency';

export interface SubjectCompetencyRepository {
  findById(id: string): Promise<SubjectCompetency | null>;
  findBySubject(subjectId: string): Promise<SubjectCompetency[]>;
  findActiveBySubject(subjectId: string): Promise<SubjectCompetency[]>;
  findBySubjectAndName(subjectId: string, name: string): Promise<SubjectCompetency | null>;
  save(competency: SubjectCompetency): Promise<void>;
  delete(id: string): Promise<void>;
}
