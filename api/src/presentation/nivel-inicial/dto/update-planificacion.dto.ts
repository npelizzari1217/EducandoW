import { z } from 'zod';

const SecuenciaDidacticaSchema = z.object({
  nombre: z.string().min(1),
  area: z.string().min(1),
  actividades: z.array(z.string()).default([]),
  recursos: z.array(z.string()).default([]),
});

export const UpdatePlanificacionSchema = z.object({
  semana: z.number().int().min(1).max(40).optional(),
  academicYear: z.string().regex(/^\d{4}$/).optional(),
  secuencias: z.array(SecuenciaDidacticaSchema).optional(),
});

export type UpdatePlanificacionDTO = z.infer<typeof UpdatePlanificacionSchema>;
