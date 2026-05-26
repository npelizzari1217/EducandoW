import { z } from 'zod';

export const UpdateTeacherSchema = z.object({
  firstName: z.string().min(1).max(200).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dni: z.string().min(7).max(9).regex(/^\d+$/, 'El DNI debe contener solo números').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
});

export type UpdateTeacherDTO = z.infer<typeof UpdateTeacherSchema>;
