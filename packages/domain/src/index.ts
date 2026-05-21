// Shared
export { Result, Ok, Err, ok, err } from './shared/result';
export { DomainError } from './shared/errors/domain-error';
export { NotFoundError } from './shared/errors/not-found-error';
export { ValidationError } from './shared/errors/validation-error';
export { DomainEvent } from './shared/events/domain-event';
export { EventBus, EventHandler } from './shared/event-bus';

// Shared Value Objects
export { Id } from './shared/value-objects/id';
export { Email } from './shared/value-objects/email';

// Institution
export { Institution } from './institution/entities';
export { Level, LevelType } from './institution/value-objects';

// Personnel
export { Student, Teacher } from './personnel/entities';
export { Dni } from './personnel/value-objects';

// Enrollment
export { Enrollment } from './enrollment/entities';

// Auth
export { User } from './auth/entities/user';
export type { UserRole } from './auth/entities/user';
export { Password } from './auth/value-objects/password';
export { UserRepository } from './auth/repositories/user-repository';
export { RefreshTokenRepository } from './auth/repositories/refresh-token-repository';
export { UserRegistered } from './auth/events/user-registered';
export { UserNotFoundError, EmailAlreadyExistsError, InvalidCredentialsError } from './auth/errors/user.errors';
