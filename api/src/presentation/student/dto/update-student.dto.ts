import { z } from 'zod';

export const UpdateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dni: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export type UpdateStudentDTO = z.infer<typeof UpdateStudentSchema>;
