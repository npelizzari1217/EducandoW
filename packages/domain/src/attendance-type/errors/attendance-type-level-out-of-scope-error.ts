import { DomainError } from '../../shared/errors/domain-error';

export class AttendanceTypeLevelOutOfScopeError extends DomainError {
  constructor(level?: number) {
    super(
      level !== undefined
        ? `AttendanceType level ${level} is out of the caller's access scope`
        : "AttendanceType level is out of the caller's access scope",
      'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE',
    );
  }
}
