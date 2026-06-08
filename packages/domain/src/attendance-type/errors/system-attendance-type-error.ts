import { DomainError } from '../../shared/errors/domain-error';

export class SystemAttendanceTypeError extends DomainError {
  constructor() {
    super(
      'AttendanceType is system-protected and cannot be mutated',
      'ATTENDANCE_TYPE_SYSTEM_PROTECTED',
    );
  }
}
