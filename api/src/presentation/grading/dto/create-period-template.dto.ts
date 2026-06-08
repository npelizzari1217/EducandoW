import { z } from 'zod';

const PeriodTemplateItemSchema = z.object({
  name: z.string().min(1, 'item name is required'),
  sortOrder: z.number().int().min(1, 'sortOrder must be >= 1'),
});

export const CreatePeriodTemplateSchema = z
  .object({
    name: z.string().min(1, 'name is required'),
    level: z.union(
      [z.literal(1), z.literal(2), z.literal(3), z.literal(4)],
      { errorMap: () => ({ message: 'level must be 1, 2, 3 or 4' }) },
    ),
    modality: z.number().int().min(0).max(2).default(0),
    items: z
      .array(PeriodTemplateItemSchema)
      .min(1, 'at least one item is required'),
  })
  .superRefine((data, ctx) => {
    const sortOrders = data.items.map((i) => i.sortOrder);
    const seen = new Set<number>();
    for (const order of sortOrders) {
      if (seen.has(order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate sortOrder ${order} — sortOrder must be unique within a template`,
          path: ['items'],
        });
        return;
      }
      seen.add(order);
    }
  });

export type CreatePeriodTemplateDTO = z.infer<typeof CreatePeriodTemplateSchema>;
