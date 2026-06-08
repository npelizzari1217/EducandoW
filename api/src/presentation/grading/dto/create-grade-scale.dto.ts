import { z } from 'zod';

export const CreateGradeScaleSchema = z.object({
  name: z.string().min(1, 'name is required'),
  level: z.union(
    [z.literal(1), z.literal(2), z.literal(3), z.literal(4)],
    { errorMap: () => ({ message: 'level must be 1, 2, 3 or 4' }) },
  ),
  modality: z.number().int().min(0).max(2).default(0),
});

export type CreateGradeScaleDTO = z.infer<typeof CreateGradeScaleSchema>;
