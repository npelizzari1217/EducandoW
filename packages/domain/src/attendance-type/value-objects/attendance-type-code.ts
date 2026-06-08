import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class AttendanceTypeCode {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AttendanceTypeCode, ValidationError> {
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.length === 0) {
      return err(new ValidationError('AttendanceTypeCode cannot be empty'));
    }
    if (trimmed.length > 4) {
      return err(
        new ValidationError(
          `AttendanceTypeCode must be at most 4 characters, got ${trimmed.length}`,
        ),
      );
    }
    return ok(new AttendanceTypeCode(trimmed));
  }

  static reconstruct(value: string): AttendanceTypeCode {
    return new AttendanceTypeCode(value);
  }

  get(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: AttendanceTypeCode): boolean {
    return this.value === other.value;
  }
}
