import { z } from 'zod';

// ── Shared helpers ────────────────────────────────────
const upper = (s: string) => s.toUpperCase().trim();
const nameField = z.string().min(1).max(200).transform(upper);
const lastNameField = z.string().min(1).max(100).transform(upper);
const dniField = z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI debe ser alfanumérico en mayúscula sin símbolos').transform(upper);
const codeField = z.string().min(1).max(50).transform(upper);
const textField = z.string().min(1).max(200).transform((s: string) => s.trim());
const gradeField = z.string().min(1).max(50).transform((s: string) => s.trim());
const emailField = z.string().email('Email inválido');
const uuidField = z.string().uuid('ID inválido');

const ALLOWED_LEVELS: [string, ...string[]] = [
  'INICIAL', 'TALLERES_INICIAL', 'BILINGÜISMO_INICIAL',
  'PRIMARIO', 'TALLERES_PRIMARIO', 'BILINGÜISMO_PRIMARIO',
  'SECUNDARIO', 'TALLERES_SECUNDARIO', 'BILINGÜISMO_SECUNDARIO',
  'TERCIARIO',
  'ADMINISTRACION', 'TODOS',
];
const levelField = z.enum(ALLOWED_LEVELS);
const modalityField = z
  .enum(['COMUN', 'TALLERES', 'BILINGÜISMO', 'TODOS'])
  .optional()
  .default('COMUN');
const levelsField = z.array(levelField).min(1, 'Al menos un nivel');

export const RegisterSchema = z.object({
  email: emailField,
  password: z.string().min(6, 'Mínimo 6 caracteres').max(128),
  name: nameField,
  role: z.enum(['ROOT', 'ADMIN', 'MANAGER', 'TEACHER', 'TUTOR', 'STUDENT']).optional().default('TEACHER'),
  institutionId: uuidField.optional(),
});
export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'La contraseña es requerida'),
});
export type LoginDTO = z.infer<typeof LoginSchema>;

export const CreateInstitutionSchema = z.object({
  name: nameField,
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  email: emailField.optional().or(z.literal('')),
  levels: levelsField,
});
export type CreateInstitutionDTO = z.infer<typeof CreateInstitutionSchema>;

export const CreateStudentSchema = z.object({
  firstName: nameField,
  lastName: lastNameField,
  dni: dniField,
  email: emailField.optional().or(z.literal('')),
  birthDate: z.string().optional(),
  guardianName: nameField.optional(),
  guardianPhone: z.string().max(50).optional(),
  motherName: nameField.optional(),
  fatherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI del padre debe ser alfanumérico en mayúscula sin símbolos').transform(upper).optional(),
  motherDni: z.string().min(6).max(12).regex(/^[A-Z0-9]+$/, 'El DNI de la madre debe ser alfanumérico en mayúscula sin símbolos').transform(upper).optional(),
  institutionId: uuidField,
});
export type CreateStudentDTO = z.infer<typeof CreateStudentSchema>;

export const CreateTeacherSchema = z.object({
  firstName: nameField,
  lastName: lastNameField,
  dni: dniField,
  email: emailField,
  phone: z.string().max(50).optional(),
  title: nameField.optional(),
  institutionId: uuidField,
  password: z.string().min(6, 'Mínimo 6 caracteres').max(128).optional(),
  active: z.boolean().optional().default(true),
});
export type CreateTeacherDTO = z.infer<typeof CreateTeacherSchema>;

export const CreateEnrollmentSchema = z.object({
  studentId: uuidField,
  institutionId: uuidField,
  level: levelField,
  modality: modalityField,
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
  grade: codeField.optional(),
  division: codeField.optional(),
});
export type CreateEnrollmentDTO = z.infer<typeof CreateEnrollmentSchema>;

export const CreateSubjectSchema = z.object({
  name: textField,
  level: levelField,
  modality: modalityField,
  institutionId: uuidField,
});
export type CreateSubjectDTO = z.infer<typeof CreateSubjectSchema>;

export const CreateCourseSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  grade: gradeField.optional(),
  division: codeField.optional(),
  level: levelField,
  modality: modalityField,
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
  institutionId: uuidField.optional(),
  studyPlanId: uuidField.optional(),
});
export type CreateCourseSectionDTO = z.infer<typeof CreateCourseSectionSchema>;

export const CreateSubjectAssignmentSchema = z.object({
  subjectId: uuidField,
  teacherId: uuidField,
  courseSectionId: uuidField,
});
export type CreateSubjectAssignmentDTO = z.infer<typeof CreateSubjectAssignmentSchema>;

export const CreateEvaluacionSchema = z.object({
  assignmentId: uuidField,
  title: nameField,
  description: z.string().max(500).optional(),
  evaluationDate: z.string(),
  weight: z.number().min(0).max(10).optional().default(1),
});
export type CreateEvaluacionDTO = z.infer<typeof CreateEvaluacionSchema>;

export const CreateNotaSchema = z.object({
  evaluationId: uuidField,
  studentId: uuidField,
  numericValue: z.number().optional(),
  qualitativeValue: z.string().max(100).optional(),
  comments: z.string().max(500).optional(),
  gradeScaleValueId: uuidField.optional(),
});
export type CreateNotaDTO = z.infer<typeof CreateNotaSchema>;

export const CreatePeriodoSchema = z.object({
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
  name: nameField,
  startDate: z.string(),
  endDate: z.string(),
});
export type CreatePeriodoDTO = z.infer<typeof CreatePeriodoSchema>;

export const CreateNotaTrimestralSchema = z.object({
  studentId: uuidField,
  assignmentId: uuidField,
  periodId: uuidField,
  finalGrade: z.number(),
  attendancePct: z.number().min(0).max(100).optional(),
});
export type CreateNotaTrimestralDTO = z.infer<typeof CreateNotaTrimestralSchema>;

export const CreateAttendanceSchema = z.object({
  studentId: uuidField,
  courseSectionId: uuidField,
  date: z.string(),
  status: z.enum(['PRE', 'AUS', 'TAR', 'JUS', 'RET']),
  note: z.string().max(300).optional(),
});
export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;

// ── Study Plans ────────────────────────────────────
export const CreateStudyPlanSchema = z.object({
  name: z.string().min(1).max(200),
  level: z.number().int().min(1).max(9),
  modality: z.number().int().min(0).max(9).optional().default(0),
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
});
export type CreateStudyPlanDTO = z.infer<typeof CreateStudyPlanSchema>;

export const UpdateStudyPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido').optional(),
  active: z.boolean().optional(),
});
export type UpdateStudyPlanDTO = z.infer<typeof UpdateStudyPlanSchema>;

export const UpdateSubjectSchema = z.object({
  name: z.string().min(1).max(200).transform((s: string) => s.trim()).optional(),
});
export type UpdateSubjectDTO = z.infer<typeof UpdateSubjectSchema>;

export const UpdateCourseSectionSchema = z.object({
  name: z.string().min(1).max(100).transform((s: string) => s.trim()).optional(),
  grade: z.string().min(1).max(50).transform((s: string) => s.trim()).optional(),
  division: z.string().min(1).max(50).transform((s: string) => s.toUpperCase().trim()).optional(),
});
export type UpdateCourseSectionDTO = z.infer<typeof UpdateCourseSectionSchema>;

export const AddCourseToPlanSchema = z.object({
  courseSectionId: uuidField,
});
export type AddCourseToPlanDTO = z.infer<typeof AddCourseToPlanSchema>;

export const AddSubjectToPlanCourseSchema = z.object({
  subjectId: uuidField,
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
});
export type AddSubjectToPlanCourseDTO = z.infer<typeof AddSubjectToPlanCourseSchema>;

// Legacy classes for controller compatibility
export class RegisterRequest { email!: string; password!: string; name!: string; role?: string; institutionId?: string; }
