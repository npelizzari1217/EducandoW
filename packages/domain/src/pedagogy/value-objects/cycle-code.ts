import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{0,14}$/;

export class CycleCode {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<CycleCode, ValidationError> {
    const normalized = value.trim().toUpperCase();
    if (!CODE_REGEX.test(normalized)) {
      return err(new ValidationError(`Cycle code must be alphanumeric uppercase, 1–15 characters, got: "${value}"`));
    }
    return ok(new CycleCode(normalized));
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
