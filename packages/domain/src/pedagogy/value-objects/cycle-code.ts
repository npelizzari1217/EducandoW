import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const CODE_REGEX = /^\d{4}$/;

export class CycleCode {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<CycleCode, ValidationError> {
    const trimmed = value.trim();
    if (!CODE_REGEX.test(trimmed)) {
      return err(new ValidationError(`Cycle code must be exactly 4 numeric digits, got: "${value}"`));
    }
    return ok(new CycleCode(trimmed));
  }

  static reconstruct(value: string): CycleCode {
    return new CycleCode(value);
  }

  get(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CycleCode): boolean {
    return this.value === other.value;
  }
}
