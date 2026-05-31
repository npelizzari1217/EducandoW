import { z } from 'zod';

export const CreateCalificacionSchema = z.object({
  studentId: z.string().uuid(),
  gradoId: z.string().uuid(),
  subjectId: z.string().uuid(),
  trimestre: z.enum(['1T', '2T', '3T']),
  nota: z.number().min(1).max(10),
  concepto: z.string().min(1),
  aprobado: z.boolean(),
});

export type CreateCalificacionDTO = z.infer<typeof CreateCalificacionSchema>;
