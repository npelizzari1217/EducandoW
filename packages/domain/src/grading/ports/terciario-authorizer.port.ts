import type { StudentScope } from './assignment-authorizer.port';

export { StudentScope };

export const TERCIARIO_AUTHORIZER = 'TerciarioAuthorizerPort' as const;

export interface TerciarioAuthorizerPort {
  /** Authorizes create/update slot + confirmar (SPEC-3.1). Resolves materiaCarreraId/anioAcademico from inscripcion. */
  canWriteGrades(
    userId: string,
    userRoles: string[],
    inscripcionMateriaId: string,
  ): Promise<boolean>;

  /** Scopes inscripciones list reads (SPEC-7.4). */
  getAllowedStudentIds(
    userId: string,
    userRoles: string[],
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<StudentScope>;
}
