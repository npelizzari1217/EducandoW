import { z } from 'zod';

export const CreateGradeScaleValueSchema = z.object({
  code: z.string().min(1, 'code is required'),
  label: z.string().min(1, 'label is required'),
  internalStatus: z.enum(['APROBADO', 'NO_APROBADO', 'EN_PROCESO', 'LIBRE'], {
    errorMap: () => ({ message: 'internalStatus must be one of: APROBADO, NO_APROBADO, EN_PROCESO, LIBRE' }),
  }),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateGradeScaleValueDTO = z.infer<typeof CreateGradeScaleValueSchema>;
