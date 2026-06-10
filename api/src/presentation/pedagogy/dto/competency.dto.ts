import { z } from 'zod';

// ── Period grading ──────────────────────────────────────
// PATCH /competency-valuations/:uuid/periods/:periodItemId

export const UpdatePeriodGradeSchema = z
  .object({
    gradeScaleValueId: z.string().uuid().nullable().optional(),
    imprimible: z.boolean().optional(),
  })
  .refine((d) => d.gradeScaleValueId !== undefined || d.imprimible !== undefined, {
    message: 'At least one of gradeScaleValueId or imprimible must be provided',
  });

export type UpdatePeriodGradeDto = z.infer<typeof UpdatePeriodGradeSchema>;

// ── Bulk-read response DTO (PR slice 1a) ────────────────
// GET /competency-valuations?courseCycleId=&studyPlanSubjectId=

export interface BulkPeriodValuationDto {
  periodItemId:      string;
  gradeScaleValueId: string | null;
  gradeCode:         string | null;
  internalStatus:    string | null;
  modificable:       boolean;
  imprimible:        boolean;
}

export interface BulkValuationResponseDto {
  valuationId:      string;
  studentId:        string;
  competencyId:     string;
  periodValuations: BulkPeriodValuationDto[];
}

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
