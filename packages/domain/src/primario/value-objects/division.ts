import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_DIVISIONS = ['A', 'B', 'C'] as const;
export type DivisionValue = (typeof VALID_DIVISIONS)[number];

export class Division {
  private constructor(private readonly _value: DivisionValue) {}

  static create(value: string): Result<Division, ValidationError> {
    const normalized = value.toUpperCase().trim() as DivisionValue;
    if (!VALID_DIVISIONS.includes(normalized)) {
      return err(new ValidationError(
        `División inválida: "${value}". Valores válidos: A, B, C`,
      ));
    }
    return ok(new Division(normalized));
  }

  get value(): DivisionValue {
    return this._value;
  }

  equals(other: Division): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
