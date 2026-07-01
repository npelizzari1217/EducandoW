import { DomainError } from '../../shared/errors/domain-error';

/**
 * Thrown when attendance registration (general or by-subject) is attempted for
 * a CourseCycle + year + month whose AttendanceMonthStatus is closed.
 * Read-only, INCONDICIONAL — applies to every role, no bypass (AC-B-4/5/6).
 * HTTP 409 — the request is well-formed, but the month's state conflicts with
 * the operation (same precedent as COURSE_CYCLE_CLOSED / GRADING_PHASE_VIOLATION).
 * Code: MONTH_CLOSED
 */
export class MonthClosedError extends DomainError {
  constructor(courseCycleId: string, year: number, month: number) {
    super(
      `Attendance month ${month}/${year} for course cycle ${courseCycleId} is closed and cannot be modified`,
      'MONTH_CLOSED',
    );
  }
}

/**
 * Thrown when generating attendance for a month whose latest previously
 * GENERATED month (AttendanceMonthStatus.findLatestBefore — not the calendar
 * predecessor, schools may skip months) is still open (AC-B-8/9/10).
 * The first-ever generated month is exempt (no previous row exists).
 * HTTP 409 — state conflict, not a payload validation error.
 * Code: PREVIOUS_MONTH_OPEN
 */
export class PreviousMonthOpenError extends DomainError {
  constructor(courseCycleId: string, year: number, month: number) {
    super(
      `Cannot generate attendance month ${month}/${year} for course cycle ${courseCycleId}: the previous generated month is still open`,
      'PREVIOUS_MONTH_OPEN',
    );
  }
}
