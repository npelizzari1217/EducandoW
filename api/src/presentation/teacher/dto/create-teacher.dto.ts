import { z } from 'zod';

export const CreateTeacherSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(100),
  lastName: z.string().min(1, 'El apellido es requerido').max(100),
  dni: z.string().min(7, 'DNI inválido').max(9),
  email: z.string().email('Email inválido'),
  phone: z.string().max(50).optional(),
  title: z.string().max(200).optional(),
  institutionId: z.string().uuid('ID de institución inválido'),
});

export type CreateTeacherDTO = z.infer<typeof CreateTeacherSchema>;
