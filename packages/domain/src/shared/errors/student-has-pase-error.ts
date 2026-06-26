import { DomainError } from './domain-error';

/**
 * Thrown when trying to remove a student from a course cycle while they have an active pase.
 * HTTP mapping: 409 Conflict (see exception.filter.ts DOMAIN_STATUS).
 */
export class StudentHasPaseError extends DomainError {
  constructor() {
    super(
      'No se puede quitar un alumno con pase registrado; revertí el pase primero',
      'STUDENT_HAS_PASE',
    );
  }
}
