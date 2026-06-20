/**
 * Asistencia application barrel — SDD-4.
 *
 * Exports all monthly attendance use-cases and their input/output types.
 * Daily attendance use-cases (to be removed in PR-3) are not re-exported here.
 */

// ── Generate ──────────────────────────────────────────────────────────────────
export { GenerateMonthlyAttendanceUseCase } from './generate-monthly-attendance.use-case';
export type {
  GenerateMonthlyAttendanceInput,
  GenerationResult,
} from './generate-monthly-attendance.use-case';

// ── Record — general ──────────────────────────────────────────────────────────
export { RecordGeneralAttendanceDayUseCase } from './record-general-attendance-day.use-case';
export type { RecordGeneralAttendanceDayInput } from './record-general-attendance-day.use-case';

// ── Record — subject ──────────────────────────────────────────────────────────
export { RecordSubjectAttendanceDayUseCase } from './record-subject-attendance-day.use-case';
export type { RecordSubjectAttendanceDayInput } from './record-subject-attendance-day.use-case';

// ── List — general ────────────────────────────────────────────────────────────
export { ListGeneralAttendanceUseCase } from './list-general-attendance.use-case';
export type { ListGeneralAttendanceInput } from './list-general-attendance.use-case';

// ── List — subject ────────────────────────────────────────────────────────────
export { ListSubjectAttendanceUseCase } from './list-subject-attendance.use-case';
export type { ListSubjectAttendanceInput } from './list-subject-attendance.use-case';
