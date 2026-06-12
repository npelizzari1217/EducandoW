import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export type IngresanteStatusValue =
  | 'INSCRIPTO'
  | 'PAGO_MATRICULA'
  | 'ACEPTADO'
  | 'INGRESO'
  | 'NO_INGRESARA';

export const VALID_INGRESANTE_STATUSES: readonly IngresanteStatusValue[] = [
  'INSCRIPTO',
  'PAGO_MATRICULA',
  'ACEPTADO',
  'INGRESO',
  'NO_INGRESARA',
];

export class IngresanteStatus {
  private constructor(public readonly value: IngresanteStatusValue) {}

  /** Allowed transitions from each state. Empty array = terminal state. */
  static readonly TRANSITIONS: Record<IngresanteStatusValue, IngresanteStatusValue[]> = {
    INSCRIPTO: ['PAGO_MATRICULA', 'NO_INGRESARA'],
    PAGO_MATRICULA: ['ACEPTADO', 'NO_INGRESARA'],
    ACEPTADO: ['INGRESO', 'NO_INGRESARA'],
    INGRESO: [],
    NO_INGRESARA: [],
  };

  canTransitionTo(next: IngresanteStatus): boolean {
    return IngresanteStatus.TRANSITIONS[this.value].includes(next.value);
  }

  isTerminal(): boolean {
    return IngresanteStatus.TRANSITIONS[this.value].length === 0;
  }

  static create(value: string): Result<IngresanteStatus, ValidationError> {
    const upperValue = value?.toUpperCase();
    if (!VALID_INGRESANTE_STATUSES.includes(upperValue as IngresanteStatusValue)) {
      return err(
        new ValidationError(
          `Invalid ingresante status: "${value}". Valid: INSCRIPTO, PAGO_MATRICULA, ACEPTADO, INGRESO, NO_INGRESARA`,
        ),
      );
    }
    return ok(new IngresanteStatus(upperValue as IngresanteStatusValue));
  }

  static reconstruct(value: IngresanteStatusValue): IngresanteStatus {
    return new IngresanteStatus(value);
  }

  equals(other: IngresanteStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
