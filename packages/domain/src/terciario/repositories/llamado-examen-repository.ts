import type { LlamadoExamen } from '../entities/llamado-examen';

export interface LlamadoExamenRepository {
  findById(id: string): Promise<LlamadoExamen | null>;
  findByAnioAcademico(anioAcademico: string): Promise<LlamadoExamen[]>;
  findOverlapping(
    anioAcademico: string,
    inicio: Date,
    fin: Date,
    excludeId?: string,
  ): Promise<LlamadoExamen[]>;
  save(llamado: LlamadoExamen): Promise<void>;
}

export const LLAMADO_EXAMEN_REPOSITORY = 'LlamadoExamenRepository';
