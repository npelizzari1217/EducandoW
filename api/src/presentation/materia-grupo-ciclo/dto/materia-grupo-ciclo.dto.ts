import { z } from 'zod';

// ── AddStudentToMateria (F3-P1) ───────────────────────────────────────────────

export const AddStudentToMateriaSchema = z.object({
  studentId: z.string().uuid(),
});
export type AddStudentToMateriaDto = z.infer<typeof AddStudentToMateriaSchema>;

// ── CreateGrupo (F3-P3) ───────────────────────────────────────────────────────

export const CreateGrupoSchema = z.object({
  userId: z.string().uuid(),
  /** AcademicCycle UUID — resolved from the CourseCycle by the client or controller. */
  cycleId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
});
export type CreateGrupoDto = z.infer<typeof CreateGrupoSchema>;

// ── AddStudentToGrupo (F3-P5) ─────────────────────────────────────────────────

export const AddStudentToGrupoSchema = z.object({
  alumnosXMateriaXCursoXCicloId: z.string().uuid(),
});
export type AddStudentToGrupoDto = z.infer<typeof AddStudentToGrupoSchema>;

// ── Response types ────────────────────────────────────────────────────────────

export interface MateriaResponse {
  id: string;
  courseCycleId: string;
  subjectId: string;
  studyPlanSubjectId?: string;
  alumnoCount: number;
  grupoCount: number;
}

export interface GrupoResponse {
  id: string;
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  name?: string;
  alumnoCount: number;
}

export interface AlumnoXMateriaResponse {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
}

export interface AlumnoXGrupoResponse {
  id: string;
  grupoId: string;
  alumnosXMateriaXCursoXCicloId: string;
}
