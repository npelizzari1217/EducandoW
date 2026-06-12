import type { AsignacionCursoXCiclo } from '../entities/asignacion-curso-x-ciclo';
import type { RolCurso, TurnoCurso } from '../entities/asignacion-curso-x-ciclo';

/**
 * Port for AsignacionCursoXCiclo persistence (Fase 4, F4-D2).
 * Tenant scoping is implicit via TenantContext.
 */
export interface AsignacionCursoXCicloRepository {
  /** Persist a new assignment. */
  assign(data: {
    courseCycleId: string;
    docenteXCicloId: string;
    rol: RolCurso;
    turno?: TurnoCurso;
  }): Promise<AsignacionCursoXCiclo>;

  /** Return all assignments for a CursoXCiclo. */
  findByCourseId(courseCycleId: string): Promise<AsignacionCursoXCiclo[]>;

  /** Return a specific (courseCycleId, docenteXCicloId) combination, if any. */
  findByCourseAndDocente(
    courseCycleId: string,
    docenteXCicloId: string,
  ): Promise<AsignacionCursoXCiclo[]>;

  /** Quick preceptor check for attendance authorization (Fase 6). */
  isPreceptor(docenteXCicloId: string, courseCycleId: string): Promise<boolean>;

  /** Delete assignment by id. */
  remove(id: string): Promise<void>;

  /** Remove all TITULAR assignments for a CursoXCiclo (used by ACC-S5 replace). */
  removeTitularesForCourse(courseCycleId: string): Promise<void>;
}
