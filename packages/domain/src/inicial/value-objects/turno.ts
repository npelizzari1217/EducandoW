import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_TURNOS = ['MAÑANA', 'TARDE'] as const;
export type TurnoValue = typeof VALID_TURNOS[number];

export class Turno {
  private constructor(private readonly value: TurnoValue) {}

  static create(value: string): Result<Turno, ValidationError> {
    if (!VALID_TURNOS.includes(value as TurnoValue)) {
      return err(new ValidationError(`Turno must be MAÑANA or TARDE. Got: ${value}`));
    }
    return ok(new Turno(value as TurnoValue));
  }

  static reconstruct(value: string): Turno {
    return new Turno(value as TurnoValue);
  }

  get(): TurnoValue {
    return this.value;
  }

  equals(other: Turno): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
