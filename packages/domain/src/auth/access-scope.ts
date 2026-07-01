import { ROLE_HIERARCHY, getHighestRoleRank } from './role-hierarchy';

export interface AccessScope {
  /** Puerta 2: rank >= SECRETARIO ve TODOS los registros de su alcance (vs solo los propios). */
  isAdministrative: boolean;
  /** Puerta 2: ROOT o ADMIN no tienen restricción de nivel. */
  allLevels: boolean;
  /** Códigos de nivel COMPUESTOS permitidos (de user.levels). Se usa cuando !allLevels. */
  compositeLevels: number[];
  /**
   * Niveles pedagógicos BASE (1-4), derivados de `compositeLevels` colapsando modalidad:
   * `Math.floor(compositeCode / 10)`, distinct y ordenado asc. Precedente: `levels.guard.ts:44`.
   * Única derivación del sistema (ADR-02). Independiente de `allLevels`: ROOT/ADMIN también
   * lo reciben calculado a partir de `compositeLevels` cuando el JWT trae niveles.
   */
  baseLevels: number[];
}

export function resolveAccessScope(user: { roles: string[]; levels?: number[] }): AccessScope {
  const rank = getHighestRoleRank(user.roles);
  const isRoot = user.roles.includes('ROOT');
  const isAdmin = user.roles.includes('ADMIN');
  const compositeLevels = user.levels ?? [];
  const baseLevels = [...new Set(compositeLevels.map((c) => Math.floor(c / 10)))].sort(
    (a, b) => a - b,
  );
  return {
    isAdministrative: rank >= ROLE_HIERARCHY.SECRETARIO,
    allLevels: isRoot || isAdmin,
    compositeLevels,
    baseLevels,
  };
}
