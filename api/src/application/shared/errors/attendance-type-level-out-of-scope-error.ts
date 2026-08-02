import { ApplicationError } from './application-error';

export class AttendanceTypeLevelOutOfScopeError extends ApplicationError {
  constructor(level?: number) {
    super(
      level !== undefined
        ? `AttendanceType level ${level} is out of the caller's access scope`
        : "AttendanceType level is out of the caller's access scope",
      'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE',
      403,
    );
  }
}
