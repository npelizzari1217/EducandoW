import { ApplicationError } from './application-error';

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
