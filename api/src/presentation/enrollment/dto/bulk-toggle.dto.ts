import { z } from 'zod';

export const BulkToggleSchema = z.object({
  flag: z.enum(['printable', 'promoted']),
  value: z.boolean(),
});

export type BulkToggleDTO = z.infer<typeof BulkToggleSchema>;
