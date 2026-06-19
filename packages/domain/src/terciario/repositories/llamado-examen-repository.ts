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
  /** Returns count of active llamados with fechaInicio strictly > afterDate (FR-4.2) */
  countAfter(anioAcademico: string, afterDate: Date): Promise<number>;
}

export const LLAMADO_EXAMEN_REPOSITORY = 'LlamadoExamenRepository';
