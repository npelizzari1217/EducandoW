import { z } from 'zod';

export const GetGradingPeriodQuerySchema = z.object({});

export type GetGradingPeriodQueryDto = z.infer<typeof GetGradingPeriodQuerySchema>;

export const SetGradingPeriodSchema = z.object({
  activeGradingPeriod: z
    .number()
    .int()
    .min(1)
    .max(4)
    .nullable(),
});

export type SetGradingPeriodDto = z.infer<typeof SetGradingPeriodSchema>;
