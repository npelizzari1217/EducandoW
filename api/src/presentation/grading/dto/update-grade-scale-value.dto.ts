import { z } from 'zod';

export const UpdateGradeScaleValueSchema = z.object({
  label: z.string().min(1).optional(),
  internalStatus: z.enum(['APROBADO', 'NO_APROBADO', 'EN_PROCESO', 'LIBRE'], {
    errorMap: () => ({ message: 'internalStatus must be one of: APROBADO, NO_APROBADO, EN_PROCESO, LIBRE' }),
  }).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type UpdateGradeScaleValueDTO = z.infer<typeof UpdateGradeScaleValueSchema>;
