import { z } from 'zod';

export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(100),
  lastName: z.string().min(1, 'El apellido es requerido').max(100),
  dni: z.string().min(7, 'DNI inválido').max(9),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  birthDate: z.string().optional(),
  guardianName: z.string().max(200).optional(),
  guardianPhone: z.string().max(50).optional(),
  institutionId: z.string().uuid('ID de institución inválido'),
});

export type CreateStudentDTO = z.infer<typeof CreateStudentSchema>;
