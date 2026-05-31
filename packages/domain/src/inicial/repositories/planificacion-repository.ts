import type { Planificacion } from '../entities/planificacion';

export interface PlanificacionFilters {
  salaId?: string;
  semana?: number;
  academicYear?: string;
  active?: boolean;
}

export interface PlanificacionRepository {
  findById(id: string): Promise<Planificacion | null>;
  findAll(filters?: PlanificacionFilters): Promise<Planificacion[]>;
  save(planificacion: Planificacion): Promise<void>;
  softDelete(id: string): Promise<void>;
}
