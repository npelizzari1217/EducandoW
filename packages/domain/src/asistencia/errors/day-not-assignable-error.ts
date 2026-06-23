import { DomainError } from '../../shared/errors/domain-error';

/**
 * Thrown when a PATCH targets a weekend or non-existent day.
 * Maps to HTTP 422 at the presentation boundary.
 * Code: DAY_NOT_ASSIGNABLE
 * Satisfies: REQ-GUARD-1, REQ-GUARD-2; AC-07, AC-08
 */
export class DayNotAssignableError extends DomainError {
  constructor(message: string) {
    super(message, 'DAY_NOT_ASSIGNABLE');
  }
}
