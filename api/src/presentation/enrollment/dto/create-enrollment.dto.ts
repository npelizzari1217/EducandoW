import { z } from 'zod';

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().uuid('ID de estudiante inválido'),
  institutionId: z.string().uuid('ID de institución inválido'),
  level: z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO']),
  academicYear: z.string().min(4).max(4),
  grade: z.string().max(50).optional(),
  division: z.string().max(10).optional(),
});

export type CreateEnrollmentDTO = z.infer<typeof CreateEnrollmentSchema>;
