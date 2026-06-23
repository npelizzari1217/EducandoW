import { DomainError } from '../../shared/errors/domain-error';

/**
 * Thrown when a PATCH provides a statusCode with assignable === false (e.g., SAB, DOM, X).
 * Maps to HTTP 400 at the presentation boundary.
 * Code: STATUS_NOT_ASSIGNABLE
 * Satisfies: REQ-GUARD-3; AC-09
 */
export class StatusNotAssignableError extends DomainError {
  constructor(message: string) {
    super(message, 'STATUS_NOT_ASSIGNABLE');
  }
}
