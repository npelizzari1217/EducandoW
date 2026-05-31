import { z } from 'zod';

export const CreateRegimenSchema = z.object({
  cursoId: z.string().uuid(),
  subjectId: z.string().uuid(),
  promocionDirecta: z.boolean(),
  requiereExamenFinal: z.boolean(),
  notaMinimaAprobacion: z.number().min(1).max(10).optional(),
});

export type CreateRegimenDTO = z.infer<typeof CreateRegimenSchema>;
