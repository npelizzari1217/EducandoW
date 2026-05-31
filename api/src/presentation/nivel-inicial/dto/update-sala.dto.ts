import { z } from 'zod';

export const UpdateSalaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ageGroup: z.number().int().refine((v) => [3, 4, 5].includes(v), 'La edad debe ser 3, 4 o 5').optional(),
  turno: z.enum(['MAÑANA', 'TARDE']).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  teacherId: z.string().uuid().optional().nullable(),
  academicYear: z.string().regex(/^\d{4}$/).optional(),
});

export type UpdateSalaDTO = z.infer<typeof UpdateSalaSchema>;
