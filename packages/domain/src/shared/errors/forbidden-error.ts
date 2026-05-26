import { DomainError } from './domain-error';

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN');
  }
}
