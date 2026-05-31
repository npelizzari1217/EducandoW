import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_PERIODOS = ['1T', '2T', '3T'] as const;
export type PeriodoValue = typeof VALID_PERIODOS[number];

export class Periodo {
  private constructor(private readonly value: PeriodoValue) {}

  static create(value: string): Result<Periodo, ValidationError> {
    if (!VALID_PERIODOS.includes(value as PeriodoValue)) {
      return err(new ValidationError(`Periodo must be 1T, 2T, or 3T. Got: ${value}`));
    }
    return ok(new Periodo(value as PeriodoValue));
  }

  static reconstruct(value: string): Periodo {
    return new Periodo(value as PeriodoValue);
  }

  get(): PeriodoValue {
    return this.value;
  }

  equals(other: Periodo): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
