import { DomainError } from '../../shared/errors/domain-error';
import { ValidationError } from '../../shared/errors/validation-error';
import { NotFoundError } from '../../shared/errors/not-found-error';

export class CycleCodeInvalidError extends ValidationError {
  constructor(code: string) {
    super(`Invalid cycle code "${code}": must be exactly 4 numeric digits`);
  }
}

export class CycleDescriptionInvalidError extends ValidationError {
  constructor() {
    super('Cycle description cannot be empty or whitespace-only');
  }
}

export class CycleCodeAlreadyExistsError extends DomainError {
  constructor(code: string) {
    super(`Cycle code "${code}" already exists`, 'CYCLE_CODE_ALREADY_EXISTS');
  }
}

export class AcademicCycleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('AcademicCycle', id);
  }
}
