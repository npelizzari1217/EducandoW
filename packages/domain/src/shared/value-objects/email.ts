import { Result, ok, err } from '../result';
import { ValidationError } from '../errors/validation-error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<Email, ValidationError> {
    if (!value || value.trim().length === 0) {
      return err(new ValidationError('Email cannot be empty'));
    }
    if (!EMAIL_REGEX.test(value.trim())) {
      return err(new ValidationError('Invalid email format'));
    }
    return ok(new Email(value.trim().toLowerCase()));
  }

  static reconstruct(value: string): Email {
    return new Email(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
