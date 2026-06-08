import { z } from 'zod';

// code and level are invariants — NOT included in the update schema.
// Default Zod behavior strips unknown keys (code, level, etc.) from the payload.
export const UpdateAttendanceTypeSchema = z.object({
  description: z.string().min(1).optional(),
  absenceValue: z.number().min(0, 'absenceValue must be >= 0').optional(),
  active: z.boolean().optional(),
  assignable: z.boolean().optional(),
});

export type UpdateAttendanceTypeDTO = z.infer<typeof UpdateAttendanceTypeSchema>;
