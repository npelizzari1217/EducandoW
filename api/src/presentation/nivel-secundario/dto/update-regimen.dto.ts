import { z } from 'zod';

export const UpdateRegimenSchema = z.object({
  promocionDirecta: z.boolean().optional(),
  requiereExamenFinal: z.boolean().optional(),
  notaMinimaAprobacion: z.number().min(1).max(10).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo es requerido' });

export type UpdateRegimenDTO = z.infer<typeof UpdateRegimenSchema>;
