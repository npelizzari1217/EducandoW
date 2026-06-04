import { z } from 'zod';

export const ToggleFlagSchema = z.object({
  flag: z.enum(['printable', 'promoted']),
});

export type ToggleFlagDTO = z.infer<typeof ToggleFlagSchema>;
