import type { PeriodoEvaluacion } from '../entities/periodo-evaluacion';

export interface PeriodoEvaluacionRepository {
  findById(id: string): Promise<PeriodoEvaluacion | null>;
  findByAcademicYear(academicYear: string): Promise<PeriodoEvaluacion[]>;
  save(periodo: PeriodoEvaluacion): Promise<void>;
  delete(id: string): Promise<void>;
}
