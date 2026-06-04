import { z } from 'zod';

export const ConsultarAlumnosExamenSchema = z.object({
  turno: z.enum(['DICIEMBRE', 'FEBRERO']),
  academicYear: z.string().min(4).max(9),
});

export type ConsultarAlumnosExamenDTO = z.infer<
  typeof ConsultarAlumnosExamenSchema
>;
