/**
 * PR4-T15 — Subject grades DTOs (read-side).
 * Zod schemas for query params. Response types are TypeScript interfaces (not Zod)
 * since they are assembled by use cases and returned as-is.
 * Write-side DTOs (UpsertSubjectPeriodGradeDto, UpsertSubjectFinalGradeDto) are DEFERRED to PR4b.
 */
import { z } from 'zod';

// ── Query params ──────────────────────────────────────────────────────────────

/** Query params for GET /grading/subject-grades (por materia) */
export const SubjectGradesBySubjectQuerySchema = z.object({
  courseCycleId: z.string().min(1, 'courseCycleId is required'),
  subjectId: z.string().min(1, 'subjectId is required'),
});

export type SubjectGradesBySubjectQueryDto = z.infer<typeof SubjectGradesBySubjectQuerySchema>;

/** Query params for GET /grading/subject-grades/by-student (por curso) */
export const SubjectGradesByStudentQuerySchema = z.object({
  courseCycleId: z.string().min(1, 'courseCycleId is required'),
  studentId: z.string().min(1, 'studentId is required'),
});

export type SubjectGradesByStudentQueryDto = z.infer<typeof SubjectGradesByStudentQuerySchema>;

// ── Teacher-filter query params (for course-cycles controller) ────────────────

/** Extended CourseCycle list query — adds optional teacher filter params */
export const TeacherCCListQuerySchema = z.object({
  teacherUserId: z.string().optional(),
  role: z.enum(['subject', 'homeroom']).optional().default('subject'),
});

export type TeacherCCListQueryDto = z.infer<typeof TeacherCCListQuerySchema>;

/**
 * Query params for GET /course-cycles/:id/subjects
 * C2 fix: teacherUserId is now optional.
 * Non-ROOT callers derive userId from JWT; only ROOT can supply teacherUserId for admin lookups.
 */
export const TeacherSubjectsQuerySchema = z.object({
  teacherUserId: z.string().min(1).optional(),
});

export type TeacherSubjectsQueryDto = z.infer<typeof TeacherSubjectsQuerySchema>;
