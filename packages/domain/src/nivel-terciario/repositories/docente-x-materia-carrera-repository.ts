import type { DocenteXMateriaCarrera } from '../docente-x-materia-carrera.entity';

export const DOCENTE_X_MATERIA_CARRERA_REPOSITORY = 'DocenteXMateriaCarreraRepository' as const;

export interface DocenteXMateriaCarreraRepository {
  /** Door 3 hot path — filters active: true */
  findActiveAssignment(
    userId: string,
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<DocenteXMateriaCarrera | null>;

  /** Used by assign use-case to detect inactive rows for reactivation (ADR-2) */
  findAny(
    userId: string,
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<DocenteXMateriaCarrera | null>;

  findById(id: string): Promise<DocenteXMateriaCarrera | null>;

  /** Returns active rows only (SPEC-4.C) */
  listByMateria(materiaCarreraId: string, anioAcademico?: string): Promise<DocenteXMateriaCarrera[]>;

  /** Returns active rows only (SPEC-4.C) */
  listByDocente(userId: string): Promise<DocenteXMateriaCarrera[]>;

  save(entity: DocenteXMateriaCarrera): Promise<void>;
}
