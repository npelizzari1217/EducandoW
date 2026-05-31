import { z } from 'zod';

export const UpdateCalificacionSchema = z.object({
  nota: z.number().min(1).max(10).optional(),
  concepto: z.string().min(1).optional(),
  aprobado: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Al menos un campo es requerido para actualizar',
});

export type UpdateCalificacionDTO = z.infer<typeof UpdateCalificacionSchema>;
