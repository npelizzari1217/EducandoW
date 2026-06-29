import { z } from 'zod';

export const UpdateGuardianSchema = z.object({
  fullName: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  relationship: z.string().min(1).max(15, 'relationship must be at most 15 characters').optional(),
  active: z.boolean().optional(),
});

export type UpdateGuardianDTO = z.infer<typeof UpdateGuardianSchema>;
