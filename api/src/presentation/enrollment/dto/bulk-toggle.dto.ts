import { z } from 'zod';

export const BulkToggleSchema = z.object({
  flag: z.enum(['printable', 'promoted']),
  value: z.boolean(),
  level: z.number().int().optional(),
  grade: z.string().optional(),
  division: z.string().optional(),
  academicYear: z.string().optional(),
});

export type BulkToggleDTO = z.infer<typeof BulkToggleSchema>;
