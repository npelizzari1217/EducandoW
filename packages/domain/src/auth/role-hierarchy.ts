/**
 * Jerarquía de roles del sistema.
 *
 * Define quién puede gestionar a quién: un usuario solo puede administrar
 * (crear, modificar, eliminar) a otros usuarios cuyo rol tenga una jerarquía
 * ESTRICTAMENTE INFERIOR a la suya.
 *
 * Esto es INDEPENDIENTE del nivel educativo (INICIAL, PRIMARIO, etc.):
 * un usuario de Nivel Primario puede ser Administrador (jerarquía 6)
 * y por lo tanto gestionar a un Docente (jerarquía 2) de Nivel Secundario.
 *
 * Valores más altos = mayor jerarquía de poder.
 * ROOT saltea toda restricción.
 */

export const ROLE_HIERARCHY: Record<string, number> = {
  ROOT: 99,
  ADMIN: 60,
  DIRECTOR: 50,
  SECRETARIO: 40,
  PRECEPTOR: 30,
  TEACHER: 20,
  TUTOR: 10,
  STUDENT: 0,
};

/** Etiquetas legibles para cada rol. */
export const ROLE_LABELS: Record<string, string> = {
  ROOT: 'Root',
  ADMIN: 'Administrador',
  DIRECTOR: 'Directivo',
  SECRETARIO: 'Secretario',
  PRECEPTOR: 'Preceptor',
  TEACHER: 'Docente',
  TUTOR: 'Tutor',
  STUDENT: 'Alumno',
};

/**
 * Devuelve la jerarquía más alta entre los roles de un usuario.
 * Si no se reconoce ningún rol, devuelve -1 (sin permisos).
 */
export function getHighestRoleRank(roles: string[]): number {
  if (roles.length === 0) return -1;
  let highest = -1;
  for (const role of roles) {
    const rank = ROLE_HIERARCHY[role] ?? -1;
    if (rank > highest) highest = rank;
  }
  return highest;
}

/**
 * Verifica si el creador puede gestionar al usuario objetivo
 * basándose en la jerarquía de roles (no en el nivel educativo).
 */
export function canManageUser(creatorRoles: string[], targetRoles: string[]): boolean {
  // ROOT tiene acceso total
  if (creatorRoles.includes('ROOT')) return true;

  const creatorRank = getHighestRoleRank(creatorRoles);
  const targetRank = getHighestRoleRank(targetRoles);

  // Sin rol reconocido, no puede gestionar
  if (creatorRank < 0) return false;

  // La jerarquía del creador debe ser estrictamente superior
  return creatorRank > targetRank;
}
