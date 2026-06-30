import { z } from 'zod';

export const UpdateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI debe ser alfanumérico en mayúscula sin símbolos').optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),  // Round7-Fix6: '' = clear the field (consistent with father/motherEmail); null = clear; absent = unchanged
  birthDate: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianPhone: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  fatherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI del padre debe ser alfanumérico en mayúscula sin símbolos').optional().nullable(),
  motherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI de la madre debe ser alfanumérico en mayúscula sin símbolos').optional().nullable(),
  fatherEmail: z.string().email().nullable().optional().or(z.literal('')),  // Round7-Fix7: null OR '' = clear the field; absent = unchanged
  motherEmail: z.string().email().nullable().optional().or(z.literal('')),  // Round7-Fix7: null OR '' = clear the field; absent = unchanged
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export type UpdateStudentDTO = z.infer<typeof UpdateStudentSchema>;
