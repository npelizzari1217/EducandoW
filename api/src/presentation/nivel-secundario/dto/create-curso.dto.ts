import { z } from 'zod';

export const CreateCursoSchema = z.object({
  courseSectionId: z.string().uuid().optional(),
  year: z.number().int().min(1).max(6),
  division: z.string().min(1).max(1),
  orientacion: z.enum(['NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE']).optional(),
  academicYear: z.string().min(4).max(9),
});

export type CreateCursoDTO = z.infer<typeof CreateCursoSchema>;
