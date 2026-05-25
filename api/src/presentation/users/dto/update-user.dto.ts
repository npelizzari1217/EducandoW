import { z } from 'zod';

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  institutionId: z.string().uuid().optional().nullable(),
  level: z.number().int().min(1).max(9).optional().nullable(),
  modality: z.number().int().min(0).max(9).optional().nullable(),
  roles: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
