import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class GradeValueCode {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<GradeValueCode, ValidationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return err(new ValidationError('GradeValueCode cannot be empty'));
    }
    return ok(new GradeValueCode(trimmed));
  }

  static reconstruct(value: string): GradeValueCode {
    return new GradeValueCode(value);
  }

  get(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: GradeValueCode): boolean {
    return this.value === other.value;
  }
}
