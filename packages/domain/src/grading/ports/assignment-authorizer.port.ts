/**
 * AssignmentAuthorizerPort — domain port (F5-D1).
 *
 * Abstracts the authorization decision for grade write operations.
 * Application layer provides the implementation (AssignmentAuthorizer).
 *
 * Contract:
 *   - ROOT: always permitted (full bypass).
 *   - SECRETARIO / DIRECTOR / ADMIN: permitted without group assignment (D3).
 *   - TEACHER (rank < SECRETARIO): permitted only if the user has a
 *     GrupoXCursoXMateriaXCiclo assigned for the given (courseCycleId, subjectId).
 *
 * Note: uses (courseCycleId, subjectId) rather than materiaXCursoXCicloId directly
 * because the write use-cases expose those parameters — the implementation resolves
 * materiaXCursoXCicloId internally.
 */

export const ASSIGNMENT_AUTHORIZER = 'AssignmentAuthorizerPort' as const;

/**
 * Tri-state read scope:
 *   'all'    → administrative bypass (SECRETARIO / DIRECTOR / ADMIN / ROOT)
 *   string[] → allowed studentIds (may be empty for an assigned-but-empty grupo)
 *   null     → forbidden (broken link in the authz chain)
 */
export type StudentScope = string[] | 'all' | null;

export interface AssignmentAuthorizerPort {
  canWriteGrades(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
    subjectId: string,
  ): Promise<boolean>;

  /**
   * Checks if a user can access (read) grade data for an entire CourseCycle
   * (e.g. the "by student" grid that shows all subjects in the CC).
   *
   * Contract:
   *   - ROOT: always permitted.
   *   - SECRETARIO / DIRECTOR / ADMIN: permitted (D3 management bypass).
   *   - TEACHER (rank < SECRETARIO): permitted only if the user has at least
   *     one GrupoXCursoXMateriaXCiclo in the given CourseCycle.
   */
  canAccessCourseCycle(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
  ): Promise<boolean>;

  /**
   * Returns the read scope for a (user, courseCycle, subject) tuple:
   *   'all'     → administrative bypass (SECRETARIO / DIRECTOR / ADMIN / ROOT)
   *   string[]  → allowed studentIds (may be empty for an assigned-but-empty grupo)
   *   null      → forbidden (any broken link in the authz chain)
   *
   * Satisfies: spec "Scope Resolution Returns an Access Scope Value" (notas-get-authz-grupo)
   */
  getAllowedStudentIds(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
    subjectId: string,
  ): Promise<StudentScope>;
}
