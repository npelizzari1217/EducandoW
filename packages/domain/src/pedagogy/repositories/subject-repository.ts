import type { Subject } from '../entities/subject';

export interface SubjectRepository {
  findById(id: string): Promise<Subject | null>;
  findByInstitution(institutionId: string): Promise<Subject[]>;
  findByLevel(institutionId: string, level: string): Promise<Subject[]>;
  save(subject: Subject): Promise<void>;
  delete(id: string): Promise<void>;
}
