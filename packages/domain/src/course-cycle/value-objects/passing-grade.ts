import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class PassingGrade {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<PassingGrade, ValidationError> {
    if (value < 1 || value > 10) {
      return err(new ValidationError(`Passing grade must be between 1 and 10, got ${value}`));
    }
    return ok(new PassingGrade(value));
  }

  static reconstruct(value: number): PassingGrade {
    return new PassingGrade(value);
  }

  get(): number {
    return this.value;
  }

  equals(other: PassingGrade): boolean {
    return this.value === other.value;
  }
}
