import type { Evaluacion } from '../entities/evaluacion';

export interface EvaluacionRepository {
  findById(id: string): Promise<Evaluacion | null>;
  findByAssignment(assignmentId: string): Promise<Evaluacion[]>;
  save(evaluacion: Evaluacion): Promise<void>;
  delete(id: string): Promise<void>;
}
