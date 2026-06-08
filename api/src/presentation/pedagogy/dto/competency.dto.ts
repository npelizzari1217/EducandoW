import { z } from 'zod';

// ── Period grading ──────────────────────────────────────
// PATCH /competency-valuations/:uuid/periods/:periodItemId

export const UpdatePeriodGradeSchema = z.object({
  gradeScaleValueId: z.string().uuid().nullable(),
});

export type UpdatePeriodGradeDto = z.infer<typeof UpdatePeriodGradeSchema>;

// ── Subject Competency ──────────────────────────────────

export const CreateSubjectCompetencySchema = z.object({
  studyPlanSubjectId: z.string().min(1, 'studyPlanSubjectId es requerido'),
  name: z.string().min(1, 'El nombre no puede estar vacío').max(255),
});

export const UpdateSubjectCompetencySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
});

export const CopySubjectCompetenciesSchema = z.object({
  sourceStudyPlanSubjectId: z.string().min(1, 'sourceStudyPlanSubjectId es requerido'),
  targetStudyPlanSubjectId: z.string().min(1, 'targetStudyPlanSubjectId es requerido'),
});

export type CreateSubjectCompetencyDTO = z.infer<typeof CreateSubjectCompetencySchema>;
export type UpdateSubjectCompetencyDTO = z.infer<typeof UpdateSubjectCompetencySchema>;
export type CopySubjectCompetenciesDTO = z.infer<typeof CopySubjectCompetenciesSchema>;
