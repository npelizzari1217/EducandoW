import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class CourseName {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<CourseName, ValidationError> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return err(new ValidationError('Course name cannot be empty'));
    }
    return ok(new CourseName(trimmed.toUpperCase()));
  }

  static reconstruct(value: string): CourseName {
    return new CourseName(value);
  }

  get(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CourseName): boolean {
    return this.value === other.value;
  }
}
