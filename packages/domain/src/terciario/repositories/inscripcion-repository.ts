import type { InscripcionMateria, CorrelativaRequerida } from '../entities/inscripcion-materia';

export interface InscripcionRepository {
  findById(id: string): Promise<InscripcionMateria | null>;
  findByStudent(studentId: string): Promise<InscripcionMateria[]>;
  findByMateriaCarrera(materiaCarreraId: string): Promise<InscripcionMateria[]>;
  findByStudentAndMateria(studentId: string, materiaCarreraId: string): Promise<InscripcionMateria | null>;
  findCorrelativas(materiaCarreraId: string): Promise<CorrelativaRequerida[]>;
  findAprobadas(studentId: string): Promise<string[]>;    // returns materiaCarreraIds
  findRegulares(studentId: string): Promise<string[]>;   // returns materiaCarreraIds
  /** Fase D: scoped read for docentes — filters by materiaCarreraId + anioAcademico */
  listByMateria(materiaCarreraId: string, anioAcademico: string): Promise<InscripcionMateria[]>;
  save(inscripcion: InscripcionMateria): Promise<void>;
  delete(id: string): Promise<void>;
}
