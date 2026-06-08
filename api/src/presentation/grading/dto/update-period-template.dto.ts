import { z } from 'zod';

const PeriodTemplateItemSchema = z.object({
  name: z.string().min(1, 'item name is required'),
  sortOrder: z.number().int().min(1, 'sortOrder must be >= 1'),
});

export const UpdatePeriodTemplateSchema = z
  .object({
    name: z.string().min(1, 'name is required').optional(),
    active: z.boolean().optional(),
    items: z.array(PeriodTemplateItemSchema).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.items) return;
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

export type UpdatePeriodTemplateDTO = z.infer<typeof UpdatePeriodTemplateSchema>;
