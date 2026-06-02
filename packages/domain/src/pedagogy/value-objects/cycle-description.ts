import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class CycleDescription {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<CycleDescription, ValidationError> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return err(new ValidationError('Cycle description cannot be empty'));
    }
    return ok(new CycleDescription(trimmed));
  }

  static reconstruct(value: string): CycleDescription {
    return new CycleDescription(value);
  }

  get(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: CycleDescription): boolean {
    return this.value === other.value;
  }
}
