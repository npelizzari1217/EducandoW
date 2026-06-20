import type { StudentObservation } from '../entities/observation';
import type { Id } from '../../shared/value-objects/id';

export interface StudentObservationRepository {
  save(observation: StudentObservation): Promise<void>;
  findById(id: Id): Promise<StudentObservation | null>;
  findByStudentId(studentId: Id): Promise<StudentObservation[]>;
  findByStudentIds(studentIds: Id[]): Promise<StudentObservation[]>;
  /**
   * Returns all observations scoped to an AcademicCycle:
   * - PEDAGOGICAL observations where academicCycleId === cycleId
   * - PSYCHOPEDAGOGICAL (EOE) observations for students who appear in the above set
   * Used by list-by-cycle and list-by-course use-cases (ADR-3).
   */
  findByAcademicCycleId(cycleId: Id): Promise<StudentObservation[]>;
  delete(id: Id): Promise<void>;
}
