import { DomainError } from '../../shared/errors/domain-error';

export class AttendanceTypeNotFoundError extends DomainError {
  constructor(id: string) {
    super(`AttendanceType with id "${id}" not found`, 'ATTENDANCE_TYPE_NOT_FOUND');
  }
}
