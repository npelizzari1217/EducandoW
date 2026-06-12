/**
 * Types for Phase 7 UI — Materia / Grupo / Asignacion
 */

export interface MateriaXCursoXCiclo {
  id: string;
  courseCycleId: string;
  subjectId: string;
  subjectName: string;
  studyPlanSubjectId: string | null;
  alumnosCount: number;
  gruposCount: number;
}

export interface GrupoXCursoXMateriaXCiclo {
  id: string;
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  /** userId from DocenteXCiclo join — used for role-based filtering on the frontend */
  userId: string;
  name: string | null;
  docenteName: string | null;
  alumnosCount?: number;
}

export interface AsignacionCursoXCiclo {
  id: string;
  courseCycleId: string;
  docenteXCicloId: string;
  rol: 'PRECEPTOR' | 'TITULAR';
  turno: 'MANANA' | 'TARDE' | 'VESPERTINO' | 'NOCHE' | null;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  docenteName?: string | null;
}

/** Roles considered "management" — they bypass group-based filtering */
export const MANAGEMENT_ROLES = ['ROOT', 'ADMIN', 'DIRECTOR', 'SECRETARIO'] as const;

export function isManagementUser(roles: string[] | undefined): boolean {
  if (!roles) return false;
  return MANAGEMENT_ROLES.some((r) => roles.includes(r));
}
