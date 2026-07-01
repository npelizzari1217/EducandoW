import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

/**
 * Behavioral classification for an AttendanceType, matching the Prisma
 * `AttendanceBehavior` enum member names 1:1 (see ADR-01).
 *
 * Numeric mapping (for reference, not used as the runtime representation):
 * 1 AUSENTE_INJUSTIFICADO, 2 AUSENTE_JUSTIFICADO, 3 NO_ELEGIBLE,
 * 4 NO_COMPUTA, 5 TARDE_INJUSTIFICADA, 6 TARDE_JUSTIFICADA, 7 DIA_NO_HABIL.
 */
export enum AttendanceBehaviorValue {
  AUSENTE_INJUSTIFICADO = 'AUSENTE_INJUSTIFICADO',
  AUSENTE_JUSTIFICADO = 'AUSENTE_JUSTIFICADO',
  NO_ELEGIBLE = 'NO_ELEGIBLE',
  NO_COMPUTA = 'NO_COMPUTA',
  TARDE_INJUSTIFICADA = 'TARDE_INJUSTIFICADA',
  TARDE_JUSTIFICADA = 'TARDE_JUSTIFICADA',
  DIA_NO_HABIL = 'DIA_NO_HABIL',
}

const VALID_VALUES = new Set(Object.values(AttendanceBehaviorValue));

/** Values that mark a day as not a día hábil (excluded from días hábiles count). */
const NO_DIA_HABIL_VALUES = new Set<AttendanceBehaviorValue>([
  AttendanceBehaviorValue.NO_ELEGIBLE,
  AttendanceBehaviorValue.DIA_NO_HABIL,
]);

export class AttendanceBehavior {
  private constructor(private readonly value: AttendanceBehaviorValue) {}

  static create(raw: string): Result<AttendanceBehavior, ValidationError> {
    if (!VALID_VALUES.has(raw as AttendanceBehaviorValue)) {
      return err(
        new ValidationError(
          `AttendanceBehavior must be one of {${[...VALID_VALUES].join(', ')}}; got "${raw}"`,
        ),
      );
    }
    return ok(new AttendanceBehavior(raw as AttendanceBehaviorValue));
  }

  static reconstruct(value: AttendanceBehaviorValue): AttendanceBehavior {
    return new AttendanceBehavior(value);
  }

  get(): AttendanceBehaviorValue {
    return this.value;
  }

  /** True for every member except NO_ELEGIBLE (ADR-03: assignable = isEligible). */
  isEligible(): boolean {
    return this.value !== AttendanceBehaviorValue.NO_ELEGIBLE;
  }

  /** False for NO_ELEGIBLE and DIA_NO_HABIL; true for the other 5 members. */
  isDiaHabil(): boolean {
    return !NO_DIA_HABIL_VALUES.has(this.value);
  }

  isTardeJustificada(): boolean {
    return this.value === AttendanceBehaviorValue.TARDE_JUSTIFICADA;
  }

  isTardeInjustificada(): boolean {
    return this.value === AttendanceBehaviorValue.TARDE_INJUSTIFICADA;
  }

  isAusenteJustificado(): boolean {
    return this.value === AttendanceBehaviorValue.AUSENTE_JUSTIFICADO;
  }

  isAusenteInjustificado(): boolean {
    return this.value === AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO;
  }

  isNoComputa(): boolean {
    return this.value === AttendanceBehaviorValue.NO_COMPUTA;
  }

  equals(other: AttendanceBehavior): boolean {
    return this.value === other.value;
  }
}
