/**
 * DTOs for Asistencia (Fase 6, F6-P5).
 *
 * Subject absence: POST/GET /grupos/:grupoId/ausencias
 * Daily attendance: POST/GET /course-cycles/:ccId/asistencia-diaria
 */
import { z } from 'zod';

// ── Subject Absence (ausencias por materia) ──────────────────────────────────

export const RecordSubjectAbsenceSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  observaciones: z.string().max(500).optional(),
});

export type RecordSubjectAbsenceDto = z.infer<typeof RecordSubjectAbsenceSchema>;

export const GetSubjectAbsencesQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export type GetSubjectAbsencesQueryDto = z.infer<typeof GetSubjectAbsencesQuerySchema>;

export interface AusenciaXGrupoResponse {
  id: string;
  grupoId: string;
  studentId: string;
  date: string;
  observaciones?: string;
  createdAt: string;
}

// ── Daily Attendance (asistencia diaria) ─────────────────────────────────────

export const RecordDailyAttendanceSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  statusCode: z.string().min(1).max(10),
  observaciones: z.string().max(500).optional(),
});

export type RecordDailyAttendanceDto = z.infer<typeof RecordDailyAttendanceSchema>;

export const GetDailyAttendanceQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export type GetDailyAttendanceQueryDto = z.infer<typeof GetDailyAttendanceQuerySchema>;

export interface AsistenciaDiariaResponse {
  id: string;
  courseCycleId: string;
  studentId: string;
  date: string;
  statusCode: string;
  observaciones?: string;
  createdAt: string;
}
