import type { PlanificacionCurso } from '../entities/planificacion-curso';

export interface PlanificacionCursoRepository {
  create(data: {
    asignacionCursoId: string;
    nombre: string;
    periodOrdinal?: number;
    descripcion?: string;
  }): Promise<PlanificacionCurso>;
  listByAsignacion(asignacionCursoId: string): Promise<PlanificacionCurso[]>;
  update(id: string, data: {
    nombre?: string;
    periodOrdinal?: number | null;
    descripcion?: string | null;
  }): Promise<PlanificacionCurso>;
  softDelete(id: string): Promise<void>;
}
