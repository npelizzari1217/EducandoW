import { z } from 'zod';

export const CreateSubjectCompetencySchema = z.object({
  studyPlanSubjectId: z.string().min(1, 'studyPlanSubjectId es requerido'),
  name: z.string().min(1, 'El nombre no puede estar vacío').max(255),
});

export const UpdateSubjectCompetencySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
});

export const UpdateCompetencyValuationSchema = z.object({
  valuation1: z.string().nullable().optional(),
  valuation2: z.string().nullable().optional(),
  valuation3: z.string().nullable().optional(),
  valuation4: z.string().nullable().optional(),
  modificable1: z.boolean().optional(),
  modificable2: z.boolean().optional(),
  modificable3: z.boolean().optional(),
  modificable4: z.boolean().optional(),
  imprimible1: z.boolean().optional(),
  imprimible2: z.boolean().optional(),
  imprimible3: z.boolean().optional(),
  imprimible4: z.boolean().optional(),
  periodActive: z.number().int().min(1).max(4).optional(),
});

export const CopySubjectCompetenciesSchema = z.object({
  sourceStudyPlanSubjectId: z.string().min(1, 'sourceStudyPlanSubjectId es requerido'),
  targetStudyPlanSubjectId: z.string().min(1, 'targetStudyPlanSubjectId es requerido'),
});

export type CreateSubjectCompetencyDTO = z.infer<typeof CreateSubjectCompetencySchema>;
export type UpdateSubjectCompetencyDTO = z.infer<typeof UpdateSubjectCompetencySchema>;
export type UpdateCompetencyValuationDTO = z.infer<typeof UpdateCompetencyValuationSchema>;
export type CopySubjectCompetenciesDTO = z.infer<typeof CopySubjectCompetenciesSchema>;
