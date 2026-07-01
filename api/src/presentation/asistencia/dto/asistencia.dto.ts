/**
 * DTOs for Asistencia Mensual (SDD-4, PR-3).
 *
 * Replaces the old daily/absence DTOs.
 *
 * Endpoints:
 *   POST /course-cycles/:ccId/asistencia-mensual/generate  → GenerateMonthlySchema
 *   GET  /course-cycles/:ccId/asistencia-mensual           → GeneralAttendanceQuerySchema
 *   PATCH /course-cycles/:ccId/asistencia-mensual/dia      → RecordGeneralDaySchema
 *   GET  /materias-curso-ciclo/:id/asistencia-mensual      → SubjectAttendanceQuerySchema
 *   PATCH /materias-curso-ciclo/:id/asistencia-mensual/dia → RecordSubjectDaySchema
 */
import { z } from 'zod';

// ── Generate monthly attendance ───────────────────────────────────────────────

export const GenerateMonthlySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export type GenerateMonthlyDto = z.infer<typeof GenerateMonthlySchema>;

export interface GenerationResultResponse {
  generalCreated: number;
  generalSkipped: number;
  materiaCreated: number;
  materiaSkipped: number;
}

// ── General attendance — list query ──────────────────────────────────────────

export const GeneralAttendanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type GeneralAttendanceQueryDto = z.infer<typeof GeneralAttendanceQuerySchema>;

// ── Record general day ────────────────────────────────────────────────────────

export const RecordGeneralDaySchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  statusCode: z.string().min(1).max(10),
});

export type RecordGeneralDayDto = z.infer<typeof RecordGeneralDaySchema>;

// ── Subject attendance — list query ──────────────────────────────────────────

export const SubjectAttendanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  grupoId: z.string().uuid().optional(),
});

export type SubjectAttendanceQueryDto = z.infer<typeof SubjectAttendanceQuerySchema>;

// ── Record subject day ────────────────────────────────────────────────────────

export const RecordSubjectDaySchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  statusCode: z.string().min(1).max(10),
});

export type RecordSubjectDayDto = z.infer<typeof RecordSubjectDaySchema>;

// ── Response shapes ───────────────────────────────────────────────────────────

export interface AsistenciaGeneralResponse {
  id: string;
  courseCycleId: string;
  studentId: string;
  /**
   * Resolved student name in "Apellido, Nombre" format (REQ-B1).
   * Empty string ('') on the PATCH /dia record path (ADR-5 — no name resolution needed there).
   */
  studentName: string;
  year: number;
  month: number;
  days: Record<string, string>;
}

export interface AsistenciaMateriaResponse {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
  /**
   * Resolved student name in "Apellido, Nombre" format (REQ-B2).
   * Empty string ('') on the PATCH /dia record path (ADR-5 — no name resolution needed there).
   */
  studentName: string;
  year: number;
  month: number;
  days: Record<string, string>;
}

// ── Attendance month status — Capacidad B (fase-bimestre-cierre-asistencia, PR-3b) ──

/** GET .../asistencia-mensual/estado?year=&month= */
export const AttendanceMonthStatusQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type AttendanceMonthStatusQueryDto = z.infer<typeof AttendanceMonthStatusQuerySchema>;

/** PATCH .../asistencia-mensual/estado — opens or closes the month (Secretario+, @Rank(40)). */
export const SetAttendanceMonthStatusSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  status: z.enum(['OPEN', 'CLOSED']),
});

export type SetAttendanceMonthStatusDto = z.infer<typeof SetAttendanceMonthStatusSchema>;

export interface AttendanceMonthStatusResponse {
  courseCycleId: string;
  year: number;
  month: number;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  closedBy: string | null;
}
