import type { CalificacionSecundario } from '../entities/calificacion-secundario';

/** Read model for the pending-exams query — includes joined display names from persistence. */
export interface PendingExamDetail {
  id: string;
  studentId: string;
  studentName: string;
  cursoId: string;
  cursoName: string;
  subjectId: string;
  subjectName: string;
  trimestre: string;
  nota: number;
  condicion: string;
  notaDiciembre: number | null;
  notaFebrero: number | null;
  definitiva: number | null;
}

export interface CalificacionSecundarioRepository {
  findById(id: string): Promise<CalificacionSecundario | null>;
  findByCurso(cursoId: string, trimestre?: string): Promise<CalificacionSecundario[]>;
  findByStudent(studentId: string): Promise<CalificacionSecundario[]>;
  findPendingExams(
    turno: 'DICIEMBRE' | 'FEBRERO',
    academicYear: string,
  ): Promise<CalificacionSecundario[]>;
  /** Returns pending exam records enriched with display names from joined Student, Subject, and Curso. */
  findPendingExamsWithDetails(
    turno: 'DICIEMBRE' | 'FEBRERO',
    academicYear: string,
  ): Promise<PendingExamDetail[]>;
  save(calificacion: CalificacionSecundario): Promise<void>;
}
