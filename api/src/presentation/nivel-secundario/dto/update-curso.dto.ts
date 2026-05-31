import { z } from 'zod';

export const UpdateCursoSchema = z.object({
  courseSectionId: z.string().uuid().optional(),
  year: z.number().int().min(1).max(6).optional(),
  division: z.string().min(1).max(1).optional(),
  orientacion: z.enum(['NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE']).optional(),
  academicYear: z.string().min(4).max(9).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo es requerido' });

export type UpdateCursoDTO = z.infer<typeof UpdateCursoSchema>;
