import type { StudentObservation } from '../entities/observation';
import type { Id } from '../../shared/value-objects/id';

export interface StudentObservationRepository {
  save(observation: StudentObservation): Promise<void>;
  findById(id: Id): Promise<StudentObservation | null>;
  findByStudentId(studentId: Id): Promise<StudentObservation[]>;
  findByStudentIds(studentIds: Id[]): Promise<StudentObservation[]>;
  delete(id: Id): Promise<void>;
}
