import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_TRIMESTRES = ['1T', '2T', '3T'] as const;
export type TrimestreValue = (typeof VALID_TRIMESTRES)[number];

export class Trimestre {
  private constructor(private readonly _value: TrimestreValue) {}

  static create(value: string): Result<Trimestre, ValidationError> {
    const normalized = value.toUpperCase().trim() as TrimestreValue;
    if (!VALID_TRIMESTRES.includes(normalized)) {
      return err(new ValidationError(
        `Trimestre inválido: "${value}". Valores válidos: 1T, 2T, 3T`,
      ));
    }
    return ok(new Trimestre(normalized));
  }

  get value(): TrimestreValue {
    return this._value;
  }

  equals(other: Trimestre): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
