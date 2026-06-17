import type { Sala } from '../entities/sala';

export interface SalaFilters {
  academicYear?: string;
  ageGroup?: number;
  turno?: string;
  active?: boolean;
}

export interface SalaRepository {
  findById(id: string): Promise<Sala | null>;
  findAll(filters?: SalaFilters): Promise<Sala[]>;
  save(sala: Sala): Promise<void>;
  softDelete(id: string): Promise<void>;
}
