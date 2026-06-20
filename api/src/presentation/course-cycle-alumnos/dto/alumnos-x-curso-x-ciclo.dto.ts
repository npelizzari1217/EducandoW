import { z } from 'zod';

// ── AddStudentToCourseCycle ───────────────────────────────────────────────────

export const AddStudentToCourseCycleSchema = z.object({
  studentId: z.string().uuid(),
});
export type AddStudentToCourseCycleDto = z.infer<typeof AddStudentToCourseCycleSchema>;

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
 */
export interface AlumnoCursoCicloItem {
  id: string;
  studentId: string;
  studentName: string;
}
