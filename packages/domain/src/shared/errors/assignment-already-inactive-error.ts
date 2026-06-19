import { DomainError } from './domain-error';

export class AssignmentAlreadyInactiveError extends DomainError {
  constructor() {
    super('La asignación ya está inactiva', 'ASSIGNMENT_ALREADY_INACTIVE');
  }
}
