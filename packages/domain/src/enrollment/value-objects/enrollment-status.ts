import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export type EnrollmentStatusValue = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED';

const VALID_STATUSES: readonly EnrollmentStatusValue[] = [
  'ACTIVE',
  'INACTIVE',
  'GRADUATED',
  'TRANSFERRED',
];

export class EnrollmentStatus {
  private constructor(public readonly value: EnrollmentStatusValue) {}

  static create(value: string): Result<EnrollmentStatus, ValidationError> {
    const upperValue = value?.toUpperCase();
    if (!VALID_STATUSES.includes(upperValue as EnrollmentStatusValue)) {
      return err(
        new ValidationError(`Invalid enrollment status: "${value}". Valid: ACTIVE, INACTIVE, GRADUATED, TRANSFERRED`),
      );
    }
    return ok(new EnrollmentStatus(upperValue as EnrollmentStatusValue));
  }

  static reconstruct(value: EnrollmentStatusValue): EnrollmentStatus {
    return new EnrollmentStatus(value);
  }

  static fromCode(code: string): EnrollmentStatus {
    const upper = code.toUpperCase();
    if (!(VALID_STATUSES as readonly string[]).includes(upper)) {
      throw new Error(`Invalid enrollment status code: "${code}"`);
    }
    return new EnrollmentStatus(upper as EnrollmentStatusValue);
  }

  equals(other: EnrollmentStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
