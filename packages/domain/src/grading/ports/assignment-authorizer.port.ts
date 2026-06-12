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

export interface AssignmentAuthorizerPort {
  canWriteGrades(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
    subjectId: string,
  ): Promise<boolean>;
}
