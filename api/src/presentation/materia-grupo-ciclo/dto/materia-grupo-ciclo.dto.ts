import { z } from 'zod';

// ── AddStudentToMateria (F3-P1) ───────────────────────────────────────────────

export const AddStudentToMateriaSchema = z.object({
  studentId: z.string().uuid(),
});
export type AddStudentToMateriaDto = z.infer<typeof AddStudentToMateriaSchema>;

// ── CreateGrupo (F3-P3) ───────────────────────────────────────────────────────

export const CreateGrupoSchema = z.object({
  userId: z.string().uuid(),
  /** AcademicCycle UUID — optional; controller resolves from CourseCycle when absent. */
  cycleId: z.string().uuid().optional(),
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
  subjectName: string;
  alumnosCount: number;
  gruposCount: number;
  /** Whether this subject is optional for cascade enrollment. MGC-R12. */
  esOptativa: boolean;
}

// ── PATCH /course-cycles/:ccId/materias/:materiaId body ───────────────────────

export const SetMateriaEsOptativaSchema = z.object({
  esOptativa: z.boolean(),
});
export type SetMateriaEsOptativaDto = z.infer<typeof SetMateriaEsOptativaSchema>;

export interface GrupoResponse {
  id: string;
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  name?: string;
  alumnosCount: number;
  userId: string;
  docenteName: string | null;
}

export interface AlumnoMateriaItem {
  id: string;
  studentId: string;
  studentName: string;
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

// ── GET /grupos query params ───────────────────────────────────────────────────

export const ListGruposGlobalQuerySchema = z.object({
  level: z.coerce.number().int().optional(),
  courseCycleId: z.string().uuid().optional(),
  materiaId: z.string().uuid().optional(),
});
export type ListGruposGlobalQueryDto = z.infer<typeof ListGruposGlobalQuerySchema>;

// ── PATCH /grupos/:id body ─────────────────────────────────────────────────────

export const UpdateGrupoSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  userId: z.string().uuid().optional(),
}).refine((d) => d.name !== undefined || d.userId !== undefined, {
  message: 'At least name or userId must be provided',
});
export type UpdateGrupoDto = z.infer<typeof UpdateGrupoSchema>;

// ── GET /grupos response item ──────────────────────────────────────────────────

export interface GrupoGlobalResponse {
  id: string;
  name?: string;
  docenteName: string | null;
  docenteUserId: string;
  materiaId: string;
  subjectName: string;
  courseCycleId: string;
  courseName: string;
  level: number;
  alumnosCount: number;
}
