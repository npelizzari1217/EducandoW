import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class Dni {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<Dni, ValidationError> {
    const cleaned = value.replace(/[.-]/g, '').trim();
    if (!/^\d{7,8}$/.test(cleaned)) {
      return err(new ValidationError('DNI must be 7 or 8 digits'));
    }
    return ok(new Dni(cleaned));
  }

  static reconstruct(value: string): Dni {
    return new Dni(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: Dni): boolean {
    return this.value === other.value;
  }
}
