import { z } from 'zod';

export const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateProfileDTO = z.infer<typeof CreateProfileSchema>;
