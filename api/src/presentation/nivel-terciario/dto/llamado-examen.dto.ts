import { z } from 'zod';

export const CreateLlamadoExamenSchema = z.object({
  nombre: z.string().min(1),
  anioAcademico: z.string().min(1),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
});

export const UpdateLlamadoExamenSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    fechaInicio: z.string().datetime().optional(),
    fechaFin: z.string().datetime().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'al menos un campo requerido' });

export const ListLlamadosExamenQuerySchema = z.object({
  anioAcademico: z.string().min(1),
});

export type CreateLlamadoExamenDTO = z.infer<typeof CreateLlamadoExamenSchema>;
export type UpdateLlamadoExamenDTO = z.infer<typeof UpdateLlamadoExamenSchema>;
export type ListLlamadosExamenQueryDTO = z.infer<typeof ListLlamadosExamenQuerySchema>;
