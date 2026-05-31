import { z } from 'zod';

const SecuenciaDidacticaSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la secuencia es requerido'),
  area: z.string().min(1, 'El área es requerida'),
  actividades: z.array(z.string()).default([]),
  recursos: z.array(z.string()).default([]),
});

export const CreatePlanificacionSchema = z.object({
  salaId: z.string().uuid('El ID de la sala debe ser un UUID válido'),
  semana: z.number().int().min(1, 'La semana debe ser mayor a 0').max(40, 'La semana no puede superar 40'),
  academicYear: z.string().regex(/^\d{4}$/, 'El año académico debe tener formato YYYY'),
  secuencias: z.array(SecuenciaDidacticaSchema).optional().default([]),
});

export type CreatePlanificacionDTO = z.infer<typeof CreatePlanificacionSchema>;
