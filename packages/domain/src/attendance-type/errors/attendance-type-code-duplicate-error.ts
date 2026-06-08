import { DomainError } from '../../shared/errors/domain-error';

export class AttendanceTypeCodeDuplicateError extends DomainError {
  constructor(level: number, code: string) {
    super(
      `AttendanceType with code "${code}" already exists for level ${level}`,
      'ATTENDANCE_TYPE_CODE_DUPLICATE',
    );
  }
}
