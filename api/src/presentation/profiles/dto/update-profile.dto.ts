import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;
