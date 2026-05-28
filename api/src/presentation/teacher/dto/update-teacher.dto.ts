import { z } from 'zod';

export const UpdateTeacherSchema = z.object({
  firstName: z.string().min(1).max(200).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI debe ser alfanumérico en mayúscula sin símbolos').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  active: z.boolean().optional(),
});

export type UpdateTeacherDTO = z.infer<typeof UpdateTeacherSchema>;
