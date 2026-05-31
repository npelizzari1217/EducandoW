import type { InformeEvolutivo } from '../entities/informe-evolutivo';

export interface InformeFilters {
  salaId?: string;
  studentId?: string;
  periodo?: string;
}

export interface InformeRepository {
  findById(id: string): Promise<InformeEvolutivo | null>;
  findAll(filters?: InformeFilters): Promise<InformeEvolutivo[]>;
  save(informe: InformeEvolutivo): Promise<void>;
}
