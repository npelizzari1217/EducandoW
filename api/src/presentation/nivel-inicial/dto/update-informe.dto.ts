import { z } from 'zod';

const AreaDesarrolloSchema = z.object({
  area: z.string().min(1),
  observacion: z.string().min(1),
  valoracion: z.string().min(1),
});

export const UpdateInformeSchema = z.object({
  periodo: z.enum(['1T', '2T', '3T']).optional(),
  fecha: z.string().optional(),
  observacionesGenerales: z.string().optional().nullable(),
  areas: z.array(AreaDesarrolloSchema).optional(),
});

export type UpdateInformeDTO = z.infer<typeof UpdateInformeSchema>;
