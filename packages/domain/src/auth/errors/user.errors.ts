import { DomainError } from '../../shared/errors/domain-error';

export class UserNotFoundError extends DomainError {
  constructor(id: string) { super(`User with id ${id} not found`, 'USER_NOT_FOUND'); }
}

export class EmailAlreadyExistsError extends DomainError {
  constructor(email: string) { super(`Email ${email} is already registered`, 'EMAIL_ALREADY_EXISTS'); }
}

export class InvalidCredentialsError extends DomainError {
  constructor() { super('Invalid email or password', 'INVALID_CREDENTIALS'); }
}
