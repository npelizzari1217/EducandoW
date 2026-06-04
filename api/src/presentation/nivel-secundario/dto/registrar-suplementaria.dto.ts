import { z } from 'zod';

export const RegistrarSuplementariaSchema = z.object({
  turno: z.enum(['DICIEMBRE', 'FEBRERO']),
  nota: z.number().min(1).max(10),
});

export type RegistrarSuplementariaDTO = z.infer<
  typeof RegistrarSuplementariaSchema
>;
