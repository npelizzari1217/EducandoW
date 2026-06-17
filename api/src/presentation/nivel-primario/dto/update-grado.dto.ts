import { z } from 'zod';

export const UpdateGradoSchema = z.object({
  courseSectionId: z.string().uuid().optional(),
  academicYear: z.string().min(4).max(9).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Al menos un campo es requerido para actualizar',
});

export type UpdateGradoDTO = z.infer<typeof UpdateGradoSchema>;
