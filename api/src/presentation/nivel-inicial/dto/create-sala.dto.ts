import { z } from 'zod';

export const CreateSalaSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  ageGroup: z.number().int().refine((v) => [3, 4, 5].includes(v), 'La edad debe ser 3, 4 o 5'),
  turno: z.enum(['MAÑANA', 'TARDE'], { message: 'El turno debe ser MAÑANA o TARDE' }),
  capacity: z.number().int().min(1, 'La capacidad debe ser mayor a 0').max(50, 'La capacidad no puede superar 50'),
  teacherId: z.string().uuid().optional(),
  academicYear: z.string().regex(/^\d{4}$/, 'El año académico debe tener formato YYYY'),
});

export type CreateSalaDTO = z.infer<typeof CreateSalaSchema>;
