import { ROLE_HIERARCHY, getHighestRoleRank } from './role-hierarchy';

export interface AccessScope {
  /** Puerta 2: rank >= SECRETARIO ve TODOS los registros de su alcance (vs solo los propios). */
  isAdministrative: boolean;
  /** Puerta 2: ROOT o ADMIN no tienen restricción de nivel. */
  allLevels: boolean;
  /** Códigos de nivel COMPUESTOS permitidos (de user.levels). Se usa cuando !allLevels. */
  compositeLevels: number[];
}

export function resolveAccessScope(user: { roles: string[]; levels?: number[] }): AccessScope {
  const rank = getHighestRoleRank(user.roles);
  const isRoot = user.roles.includes('ROOT');
  const isAdmin = user.roles.includes('ADMIN');
  return {
    isAdministrative: rank >= ROLE_HIERARCHY.SECRETARIO,
    allLevels: isRoot || isAdmin,
    compositeLevels: user.levels ?? [],
  };
}
