/**
 * AttendanceMonthStatus — domain entity.
 *
 * One row per (CourseCycle, Year, Month). Absence of a row means OPEN
 * (default-open, no cutover — design §B1). Capacidad B (cierre mensual de
 * asistencia) is ORTOGONAL to Capacidad A (fase de calificación): this
 * entity never reads GradingPhase/CourseCycle.gradingPhase (AC-B-15).
 *
 * Applies to ALL pedagogical levels, including Inicial/Terciario (AC-B-14).
 */
import { Id } from '../../shared/value-objects/id';

export interface AttendanceMonthStatusProps {
  id: Id;
  courseCycleId: string;
  year: number;
  month: number;
  closed: boolean;
  closedAt: Date | null;
  closedBy: string | null;
}

export type CreateAttendanceMonthStatusInput = Omit<
  AttendanceMonthStatusProps,
  'id' | 'closed' | 'closedAt' | 'closedBy'
>;

export class AttendanceMonthStatus {
  private constructor(private props: AttendanceMonthStatusProps) {}

  static create(input: CreateAttendanceMonthStatusInput): AttendanceMonthStatus {
    return new AttendanceMonthStatus({
      ...input,
      id: Id.create(),
      closed: false,
      closedAt: null,
      closedBy: null,
    });
  }

  static reconstruct(props: AttendanceMonthStatusProps): AttendanceMonthStatus {
    return new AttendanceMonthStatus(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get courseCycleId(): string {
    return this.props.courseCycleId;
  }

  get year(): number {
    return this.props.year;
  }

  get month(): number {
    return this.props.month;
  }

  get closed(): boolean {
    return this.props.closed;
  }

  get closedAt(): Date | null {
    return this.props.closedAt;
  }

  get closedBy(): string | null {
    return this.props.closedBy;
  }

  /**
   * Monotonic chronological ordinal: year*12 + (month-1). Used to compare two
   * months regardless of calendar adjacency — schools may skip months, so
   * "previous month" means the latest GENERATED month with a strictly lower
   * ordinal, not necessarily the calendar predecessor (AC-B-8/9/10).
   */
  get monthOrdinal(): number {
    return this.props.year * 12 + (this.props.month - 1);
  }

  isClosed(): boolean {
    return this.props.closed;
  }

  /**
   * Can attendance be recorded (general or by-subject) this month right now?
   * Incondicional: depends ONLY on open/closed — no role is exempt, not even
   * ROOT/ADMIN (AC-B-4/5/6). Role-based access to the record endpoint itself
   * is a separate, unconditional guard applied at the application layer.
   */
  canRecord(): boolean {
    return !this.props.closed;
  }

  /** Closes the month. Reversible via open(). */
  close(userId: string): void {
    this.props.closed = true;
    this.props.closedAt = new Date();
    this.props.closedBy = userId;
  }

  /**
   * Reopens the month, clearing closedAt/closedBy. Permitted even when a
   * later month has already been generated (design §B1 — reopening never
   * affects other months). `userId` is accepted for signature symmetry with
   * close() but is not persisted: reopening clears attribution rather than
   * recording a new one.
   */
  open(_userId: string): void {
    this.props.closed = false;
    this.props.closedAt = null;
    this.props.closedBy = null;
  }

  /**
   * Can a NEW month be generated given the latest previously GENERATED month
   * (resolved by the caller via AttendanceMonthStatusRepository.findLatestBefore
   * — NOT the calendar predecessor)? `previous === null` means no month has
   * ever been generated for this CourseCycle yet — the first month is exempt
   * (AC-B-9/10). Otherwise generation requires that previous month to be
   * closed (AC-B-8).
   */
  static canGenerate(previous: AttendanceMonthStatus | null): boolean {
    if (previous === null) {
      return true;
    }
    return previous.isClosed();
  }
}
