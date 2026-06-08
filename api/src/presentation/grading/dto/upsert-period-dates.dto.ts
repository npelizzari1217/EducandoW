import { z } from 'zod';

const PeriodDateEntrySchema = z
  .object({
    itemId: z.string().uuid('itemId must be a valid UUID'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate >= data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be strictly before endDate',
        path: ['startDate'],
      });
    }
  });

export const UpsertPeriodDatesSchema = z.object({
  cycleId: z.string().uuid('cycleId must be a valid UUID'),
  dates: z.array(PeriodDateEntrySchema).min(1, 'Debe enviar al menos un período'),
});

export type UpsertPeriodDatesDTO = z.infer<typeof UpsertPeriodDatesSchema>;
