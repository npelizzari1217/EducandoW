import { z } from 'zod';

const dateString = z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Must be a valid ISO date string' });

export const CreateAcademicCycleSchema = z.object({
  code: z.string().length(4, 'Code must be exactly 4 characters'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  level: z.coerce.number().int().min(1).max(9),
  modality: z.coerce.number().int().min(0).optional(),
  startDate: dateString,
  endDate: dateString,
  firstBimonthStart: dateString.optional(),
  firstBimonthEnd: dateString.optional(),
  secondBimonthStart: dateString.optional(),
  secondBimonthEnd: dateString.optional(),
  thirdBimonthStart: dateString.optional(),
  thirdBimonthEnd: dateString.optional(),
  fourthBimonthStart: dateString.optional(),
  fourthBimonthEnd: dateString.optional(),
});

export const UpdateAcademicCycleSchema = z.object({
  code: z.string().length(4).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  active: z.boolean().optional(),
  firstBimonthStart: dateString.optional(),
  firstBimonthEnd: dateString.optional(),
  secondBimonthStart: dateString.optional(),
  secondBimonthEnd: dateString.optional(),
  thirdBimonthStart: dateString.optional(),
  thirdBimonthEnd: dateString.optional(),
  fourthBimonthStart: dateString.optional(),
  fourthBimonthEnd: dateString.optional(),
});

export type CreateAcademicCycleDTO = z.infer<typeof CreateAcademicCycleSchema>;
export type UpdateAcademicCycleDTO = z.infer<typeof UpdateAcademicCycleSchema>;
