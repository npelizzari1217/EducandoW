import { z } from 'zod';

export const UpdateGradeScaleSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export type UpdateGradeScaleDTO = z.infer<typeof UpdateGradeScaleSchema>;
