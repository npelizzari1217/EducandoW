import { z } from 'zod';

export const CreateMesaExamenSchema = z.object({
  subjectId: z.string().uuid(),
  fecha: z.string().datetime(),
  turno: z.enum(['DICIEMBRE', 'FEBRERO']),
  presidenteId: z.string().uuid(),
});

export type CreateMesaExamenDTO = z.infer<typeof CreateMesaExamenSchema>;
