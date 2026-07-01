import { z } from 'zod';
import { AttendanceBehaviorValue } from '@educandow/domain';

// code and level are invariants — NOT included in the update schema.
// Default Zod behavior strips unknown keys (code, level, etc.) from the payload.
export const UpdateAttendanceTypeSchema = z.object({
  description: z.string().min(1).optional(),
  absenceValue: z.number().min(0, 'absenceValue must be >= 0').optional(),
  active: z.boolean().optional(),
  behavior: z.nativeEnum(AttendanceBehaviorValue).optional(),
});

export type UpdateAttendanceTypeDTO = z.infer<typeof UpdateAttendanceTypeSchema>;
