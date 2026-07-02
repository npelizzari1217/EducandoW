import { DomainError } from '../../shared/errors/domain-error';

/**
 * Thrown/returned (as Result.err) when a level has no AttendanceType
 * configured as Presente (isPresent && isSystem), e.g. because an admin
 * deactivated or soft-deleted the "P" system type for that level.
 * Code: PRESENTE_TYPE_NOT_FOUND — mapped to HTTP 422 (recoverable config error).
 */
export class PresenteTypeNotFoundError extends DomainError {
  constructor(level: number, courseCycleId: string) {
    super(
      `No hay AttendanceType Presente configurado para el nivel ${level} (curso ${courseCycleId})`,
      'PRESENTE_TYPE_NOT_FOUND',
    );
  }
}
