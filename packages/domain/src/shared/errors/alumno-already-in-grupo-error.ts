import { DomainError } from './domain-error';

/**
 * Thrown when a student is already assigned to a group of the same materia.
 * HTTP mapping: 409 Conflict (see exception.filter.ts DOMAIN_STATUS).
 * Rule: one student → one group per materia (exclusión estricta, MGC-S13).
 */
export class AlumnoAlreadyInGrupoError extends DomainError {
  constructor() {
    super(
      'El alumno ya está asignado a un grupo de esta materia',
      'ALUMNO_ALREADY_IN_GRUPO',
    );
  }
}
