import { z } from 'zod';

export const CreateSubjectSchema = z.object({ name: z.string().min(1).max(200), level: z.enum(['INICIAL','PRIMARIO','SECUNDARIO','TERCIARIO']), institutionId: z.string().uuid() });
export const CreateCourseSectionSchema = z.object({ name: z.string().min(1).max(100), grade: z.string().optional(), division: z.string().optional(), level: z.enum(['INICIAL','PRIMARIO','SECUNDARIO','TERCIARIO']), academicYear: z.string().length(4), institutionId: z.string().uuid() });
export const CreateSubjectAssignmentSchema = z.object({ subjectId: z.string().uuid(), teacherId: z.string().uuid(), courseSectionId: z.string().uuid() });
export const CreateGradeSchema = z.object({ studentId: z.string().uuid(), subjectId: z.string().uuid(), courseSectionId: z.string().uuid(), period: z.string(), numericValue: z.number().optional(), qualitativeValue: z.string().optional(), status: z.string().optional() });
export const CreateAttendanceSchema = z.object({ studentId: z.string().uuid(), courseSectionId: z.string().uuid(), date: z.string(), status: z.enum(['PRESENT','ABSENT','LATE','JUSTIFIED']), note: z.string().optional() });

export type CreateSubjectDTO = z.infer<typeof CreateSubjectSchema>;
export type CreateCourseSectionDTO = z.infer<typeof CreateCourseSectionSchema>;
export type CreateSubjectAssignmentDTO = z.infer<typeof CreateSubjectAssignmentSchema>;
export type CreateGradeDTO = z.infer<typeof CreateGradeSchema>;
export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;
