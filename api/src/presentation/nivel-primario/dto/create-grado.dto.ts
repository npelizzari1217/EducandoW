import { z } from 'zod';

export const CreateGradoSchema = z.object({
  courseSectionId: z.string().uuid().optional(),
  grade: z.number().int().min(1).max(6),
  division: z.enum(['A', 'B', 'C']),
  teacherId: z.string().uuid().optional(),
  academicYear: z.string().min(4).max(9),
});

export type CreateGradoDTO = z.infer<typeof CreateGradoSchema>;
