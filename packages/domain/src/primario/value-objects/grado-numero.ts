import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_GRADES = [1, 2, 3, 4, 5, 6] as const;
export type GradoNumeroValue = (typeof VALID_GRADES)[number];

export class GradoNumero {
  private constructor(private readonly _value: GradoNumeroValue) {}

  static create(value: number): Result<GradoNumero, ValidationError> {
    if (!VALID_GRADES.includes(value as GradoNumeroValue)) {
      return err(new ValidationError(
        `Grado inválido: "${value}". Valores válidos: 1, 2, 3, 4, 5, 6`,
      ));
    }
    return ok(new GradoNumero(value as GradoNumeroValue));
  }

  get value(): GradoNumeroValue {
    return this._value;
  }

  equals(other: GradoNumero): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return String(this._value);
  }
}
