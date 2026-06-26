import { z } from 'zod';

// ── AddStudentToCourseCycle ───────────────────────────────────────────────────

export const AddStudentToCourseCycleSchema = z.object({
  studentId: z.string().uuid(),
});
export type AddStudentToCourseCycleDto = z.infer<typeof AddStudentToCourseCycleSchema>;

// ── PrintableToggle (SDD-2) ───────────────────────────────────────────────────

/**
 * Body for PATCH /course-cycles/:ccId/alumnos/:id/printable (single toggle).
 * Body for PATCH /course-cycles/:ccId/alumnos/printable (bulk toggle).
 */
export const SetPrintableSchema = z.object({
  value: z.boolean(),
});
export type SetPrintableDto = z.infer<typeof SetPrintableSchema>;

// ── RegistrarPase (pase-alumno-egreso) ───────────────────────────────────────

/**
 * Body for PATCH /course-cycles/:ccId/alumnos/:id/pase.
 * fechaDePase: ISO date string YYYY-MM-DD (register) or null (revert).
 */
export const RegistrarPaseSchema = z.object({
  fechaDePase: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD')
    .nullable(),
});
export type RegistrarPaseDto = z.infer<typeof RegistrarPaseSchema>;

// ── Response types ────────────────────────────────────────────────────────────

/**
 * Shape returned by POST /course-cycles/:ccId/alumnos (201).
 * Mirrors AlumnoXMateriaResponse from materia-grupo-ciclo.
 */
export interface AlumnoXCursoCicloResponse {
  id: string;
  courseCycleId: string;
  studentId: string;
}

/**
 * Shape returned per item by GET /course-cycles/:ccId/alumnos (200).
 * Enriched with studentName resolved from Student.firstName + lastName.
 * SDD-2: includes printable boolean gate for boletín printing (REQ-LIST-1).
 */
export interface AlumnoCursoCicloItem {
  id: string;
  studentId: string;
  studentName: string;
  /** Whether this student is included in the next print batch. SDD-2. */
  printable: boolean;
  /** ISO 8601 date string or null when no pase has been registered. pase-alumno-egreso. */
  fechaDePase: string | null;
}
