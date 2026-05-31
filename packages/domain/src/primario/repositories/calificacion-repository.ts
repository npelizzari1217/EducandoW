import type { CalificacionPrimario } from '../entities/calificacion-primario';

export interface CalificacionPrimarioRepository {
  findById(id: string): Promise<CalificacionPrimario | null>;
  findAll(gradoId?: string, studentId?: string): Promise<CalificacionPrimario[]>;
  save(calificacion: CalificacionPrimario): Promise<void>;
  delete(id: string): Promise<void>;
}
