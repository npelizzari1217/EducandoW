/**
 * PR4-T15 — Subject grades DTOs (read-side + write-side).
 * Read-side: Zod schemas for query params.
 * Write-side (PR4b): UpsertSubjectPeriodGradesSchema, UpsertSubjectFinalGradesSchema.
 * Response types are TypeScript interfaces (not Zod) since they are assembled by use cases.
 */
import { z } from 'zod';
import { SubjectFinalGradeType, SubjectFinalGradeCondicion } from '@educandow/domain';

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

// ── Write-side DTOs (PR4b) ────────────────────────────────────────────────────

/**
 * One period-grade + flags row in the batch upsert body.
 * gradeScaleValueId=null clears the grade; omitted leaves grade fields unchanged.
 * pa/ppi/pp omitted fields retain their prior value (AD-3, PPF-R4).
 */
const UpsertPeriodGradeItemSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  courseCycleId: z.string().min(1, 'courseCycleId is required'),
  subjectId: z.string().min(1, 'subjectId is required'),
  periodOrdinal: z.number().int().min(1, 'periodOrdinal must be >= 1'),
  gradeScaleValueId: z.string().min(1).nullable().optional(),
  pa: z.boolean().optional(),
  ppi: z.boolean().optional(),
  pp: z.boolean().optional(),
});

/** PUT /grading/subject-grades — batch upsert period grades + flags. */
export const UpsertSubjectPeriodGradesSchema = z.object({
  items: z.array(UpsertPeriodGradeItemSchema).min(1, 'items must not be empty'),
});

export type UpsertSubjectPeriodGradesDto = z.infer<typeof UpsertSubjectPeriodGradesSchema>;

/**
 * One final-grade row in the batch upsert body.
 * type must be one of the four SubjectFinalGradeType values.
 * passed is accepted on all types (SFG-R4).
 * gradeScaleValueId must be a non-empty string when provided; null is rejected (AD-2:
 * SubjectFinalGrade has no clearGrade() — clearing final grades is not supported).
 * condicion: optional year-end verdict (REGULAR | PREVIA | LIBRE) for the FINAL row.
 * W-1 MANDATORY: validated with z.nativeEnum so invalid strings → 400 (not 500).
 */
const UpsertFinalGradeItemSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  courseCycleId: z.string().min(1, 'courseCycleId is required'),
  subjectId: z.string().min(1, 'subjectId is required'),
  type: z.nativeEnum(SubjectFinalGradeType, {
    errorMap: () => ({
      message: `type must be one of: ${Object.values(SubjectFinalGradeType).join(', ')}`,
    }),
  }),
  gradeScaleValueId: z.string().min(1).optional(),
  passed: z.boolean().optional(),
  condicion: z.nativeEnum(SubjectFinalGradeCondicion, {
    errorMap: () => ({
      message: `condicion must be one of: ${Object.values(SubjectFinalGradeCondicion).join(', ')}`,
    }),
  }).optional(),
});

/** PUT /grading/subject-final-grades — batch upsert final grades. */
export const UpsertSubjectFinalGradesSchema = z.object({
  items: z.array(UpsertFinalGradeItemSchema).min(1, 'items must not be empty'),
});

export type UpsertSubjectFinalGradesDto = z.infer<typeof UpsertSubjectFinalGradesSchema>;
