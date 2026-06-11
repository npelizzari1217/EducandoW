import { z } from 'zod';

export const CreateCourseCycleSchema = z.object({
  courseId: z.string().uuid(),
  studyPlanId: z.string().uuid(),
  cycleId: z.string().uuid(),
  courseName: z.string().min(1).transform((v) => v.toUpperCase()),
  level: z.string().min(1),
  passingGrade: z.number().min(1).max(10),
  promotionText: z.string().optional().nullable(),
  firstBimonthStart: z.string().min(1).optional(),
  firstBimonthEnd: z.string().min(1).optional(),
  secondBimonthStart: z.string().min(1).optional(),
  secondBimonthEnd: z.string().min(1).optional(),
  thirdBimonthStart: z.string().min(1).optional(),
  thirdBimonthEnd: z.string().min(1).optional(),
  fourthBimonthStart: z.string().min(1).optional(),
  fourthBimonthEnd: z.string().min(1).optional(),
});

export type CreateCourseCycleDto = z.infer<typeof CreateCourseCycleSchema>;

export const UpdateCourseCycleSchema = z.object({
  courseName: z.string().min(1).transform((v) => v.toUpperCase()).optional(),
  passingGrade: z.number().min(1).max(10).optional(),
  active: z.boolean().optional(),
  promotionText: z.string().optional().nullable(),
  firstBimonthStart: z.string().min(1).optional(),
  firstBimonthEnd: z.string().min(1).optional(),
  secondBimonthStart: z.string().min(1).optional(),
  secondBimonthEnd: z.string().min(1).optional(),
  thirdBimonthStart: z.string().min(1).optional(),
  thirdBimonthEnd: z.string().min(1).optional(),
  fourthBimonthStart: z.string().min(1).optional(),
  fourthBimonthEnd: z.string().min(1).optional(),
});

export type UpdateCourseCycleDto = z.infer<typeof UpdateCourseCycleSchema>;

export const GenerateCourseCyclesSchema = z.object({
  level: z.number().int().min(10).max(40),
  cycleId: z.string().min(1),
  studyPlanId: z.string().min(1).optional(),
});

export type GenerateCourseCyclesDto = z.infer<typeof GenerateCourseCyclesSchema>;

export const CourseCycleListQuerySchema = z.object({
  level: z.coerce.number().int().optional(),
  cycleId: z.string().uuid().optional(),
  active: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : undefined),
    z.boolean().optional(),
  ),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CourseCycleListQueryDto = z.infer<typeof CourseCycleListQuerySchema>;
