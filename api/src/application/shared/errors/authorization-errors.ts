import { ApplicationError } from './application-error';

export class InsufficientRoleHierarchyError extends ApplicationError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_ROLE_HIERARCHY', 403);
  }
}

export class CrossInstitutionForbiddenError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CROSS_INSTITUTION_FORBIDDEN', 403);
  }
}
