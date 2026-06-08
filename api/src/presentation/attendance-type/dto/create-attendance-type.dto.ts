import { z } from 'zod';

export const CreateAttendanceTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'code is required')
    .max(4, 'code must be at most 4 characters')
    .transform((v) => v.toUpperCase().trim()),
  description: z.string().min(1, 'description is required'),
  absenceValue: z.number().min(0, 'absenceValue must be >= 0'),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ], { errorMap: () => ({ message: 'level must be 1, 2, 3 or 4 (ADMINISTRACION not allowed)' }) }),
  assignable: z.boolean(),
  active: z.boolean().optional().default(true),
});

export type CreateAttendanceTypeDTO = z.infer<typeof CreateAttendanceTypeSchema>;
