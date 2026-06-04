import type { CalificacionSecundario } from '../entities/calificacion-secundario';

export interface CalificacionSecundarioRepository {
  findById(id: string): Promise<CalificacionSecundario | null>;
  findByCurso(cursoId: string, trimestre?: string): Promise<CalificacionSecundario[]>;
  findByStudent(studentId: string): Promise<CalificacionSecundario[]>;
  findPendingExams(
    turno: 'DICIEMBRE' | 'FEBRERO',
    academicYear: string,
  ): Promise<CalificacionSecundario[]>;
  save(calificacion: CalificacionSecundario): Promise<void>;
}
