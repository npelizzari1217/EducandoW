/**
 * Types for Phase 7 UI — Materia / Grupo / Asignacion
 */

/**
 * RolCurso — const mirror of the domain enum.
 * SSOT: packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts
 * SPEC-1: must contain exactly 6 values and stay in sync with the domain enum.
 *
 * Note: the domain package outputs CJS (tsc default) which Rollup cannot statically analyze
 * for named value imports. This const+type pattern provides equivalent type safety without
 * a build-time CJS→ESM conversion step (ADR-2 intent: no drift; import mechanism: pragmatic).
 */
export const RolCurso = {
  PRECEPTOR: 'PRECEPTOR',
  TITULAR: 'TITULAR',
  SECRETARIO: 'SECRETARIO',
  DIRECTOR: 'DIRECTOR',
  EOE: 'EOE',
  DOCENTE_AUXILIAR: 'DOCENTE_AUXILIAR',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type RolCurso = (typeof RolCurso)[keyof typeof RolCurso];

/**
 * Spanish display labels for each RolCurso value.
 * Lives in presentation (not domain) — per ADR-2.
 * EOE stays as the institutional acronym (not spelled out).
 */
export const ROL_CURSO_LABELS: Record<RolCurso, string> = {
  [RolCurso.PRECEPTOR]: 'Preceptor',
  [RolCurso.TITULAR]: 'Titular',
  [RolCurso.SECRETARIO]: 'Secretario',
  [RolCurso.DIRECTOR]: 'Director',
  [RolCurso.EOE]: 'EOE',
  [RolCurso.DOCENTE_AUXILIAR]: 'Docente Auxiliar',
};

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
  rol: RolCurso;
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
