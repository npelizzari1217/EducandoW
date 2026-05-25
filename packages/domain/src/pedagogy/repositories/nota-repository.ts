import type { Nota } from '../entities/nota';

export interface NotaRepository {
  findById(id: string): Promise<Nota | null>;
  findByEvaluation(evaluationId: string): Promise<Nota[]>;
  findByStudent(studentId: string): Promise<Nota[]>;
  save(nota: Nota): Promise<void>;
  delete(id: string): Promise<void>;
}
