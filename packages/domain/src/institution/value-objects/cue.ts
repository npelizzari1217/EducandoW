import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class Cue {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<Cue, ValidationError> {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed || trimmed.length === 0) {
      return err(new ValidationError('CUE cannot be empty'));
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      return err(
        new ValidationError(
          `Invalid CUE: "${value}". Must be alphanumeric (uppercase letters and digits)`,
        ),
      );
    }
    return ok(new Cue(trimmed));
  }

  static reconstruct(value: string): Cue {
    return new Cue(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: Cue): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
