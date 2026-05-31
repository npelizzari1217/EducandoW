import { z } from 'zod';

const AreaDesarrolloSchema = z.object({
  area: z.string().min(1, 'El área es requerida'),
  observacion: z.string().min(1, 'La observación es requerida'),
  valoracion: z.string().min(1, 'La valoración es requerida'),
});

export const CreateInformeSchema = z.object({
  studentId: z.string().uuid('El ID del estudiante debe ser un UUID válido'),
  salaId: z.string().uuid('El ID de la sala debe ser un UUID válido'),
  periodo: z.enum(['1T', '2T', '3T'], { message: 'El período debe ser 1T, 2T o 3T' }),
  fecha: z.string().min(1, 'La fecha es requerida'),
  observacionesGenerales: z.string().optional(),
  areas: z.array(AreaDesarrolloSchema).optional().default([]),
});

export type CreateInformeDTO = z.infer<typeof CreateInformeSchema>;
