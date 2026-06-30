import { z } from 'zod';

export const UpdateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI debe ser alfanumérico en mayúscula sin símbolos').optional(),
  email: z.string().email().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianPhone: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  fatherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI del padre debe ser alfanumérico en mayúscula sin símbolos').optional().nullable(),
  motherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI de la madre debe ser alfanumérico en mayúscula sin símbolos').optional().nullable(),
  fatherEmail: z.string().email().nullable().optional().or(z.literal('')),  // Round4-Bug3: null = explicit clear; '' = unchanged/empty
  motherEmail: z.string().email().nullable().optional().or(z.literal('')),  // Round4-Bug3: same
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export type UpdateStudentDTO = z.infer<typeof UpdateStudentSchema>;
