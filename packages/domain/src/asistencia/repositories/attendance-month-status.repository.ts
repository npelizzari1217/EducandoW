/**
 * AttendanceMonthStatusRepository — port for AttendanceMonthStatus persistence.
 * Capacidad B (cierre mensual de asistencia). Tenant scoping is implicit via
 * TenantContext, same convention as AsistenciaGeneralRepository/AsistenciaMateriaRepository.
 */
import type { AttendanceMonthStatus } from '../entities/attendance-month-status';

export interface AttendanceMonthStatusRepository {
  /** Find the status row for an exact (courseCycleId, year, month). Null if never generated (default open). */
  findOne(courseCycleId: string, year: number, month: number): Promise<AttendanceMonthStatus | null>;

  /**
   * Find the row with the greatest monthOrdinal strictly BEFORE (year, month)
   * for this courseCycleId — the latest GENERATED month, not the calendar
   * predecessor (schools may skip months, AC-B-8/9/10). Null when no earlier
   * month has ever been generated (first-month exemption).
   */
  findLatestBefore(courseCycleId: string, year: number, month: number): Promise<AttendanceMonthStatus | null>;

  /**
   * Create-or-update the row for (courseCycleId, year, month). Used both to
   * register a newly generated month (OPEN, only if no row exists yet — MUST
   * NOT reopen an existing CLOSED row on regeneration) and to persist
   * close()/open() transitions.
   */
  upsert(status: AttendanceMonthStatus): Promise<void>;
}
