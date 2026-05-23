import type { Subject } from '../entities/subject';
import type { LevelType } from '../../institution/value-objects/level';

export interface SubjectRepository {
  findById(id: string): Promise<Subject | null>;
  findByInstitution(institutionId: string): Promise<Subject[]>;
  findByLevel(institutionId: string, level: LevelType): Promise<Subject[]>;
  save(subject: Subject): Promise<void>;
  delete(id: string): Promise<void>;
}
