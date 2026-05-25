import { z } from 'zod';

export const UpdateModuleSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export type UpdateModuleDTO = z.infer<typeof UpdateModuleSchema>;
