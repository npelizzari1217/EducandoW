import { z } from 'zod';

// ── Shared helpers ────────────────────────────────────
const upper = (s: string) => s.toUpperCase().trim();
const nameField = z.string().min(1).max(200).transform(upper);
const lastNameField = z.string().min(1).max(100).transform(upper);
const dniField = z.string().min(7).max(9).regex(/^\d+$/, 'El DNI debe contener solo números');
const codeField = z.string().min(1).max(50).transform(upper);
const emailField = z.string().email('Email inválido');
const uuidField = z.string().uuid('ID inválido');

export const RegisterSchema = z.object({
  email: emailField,
  password: z.string().min(6, 'Mínimo 6 caracteres').max(128),
  name: nameField,
  role: z.enum(['ADMIN', 'MANAGER', 'TEACHER']).optional().default('TEACHER'),
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
  levels: z.array(z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'])).min(1, 'Al menos un nivel'),
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
});
export type CreateTeacherDTO = z.infer<typeof CreateTeacherSchema>;

export const CreateEnrollmentSchema = z.object({
  studentId: uuidField,
  institutionId: uuidField,
  level: z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO']),
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
  grade: codeField.optional(),
  division: codeField.optional(),
});
export type CreateEnrollmentDTO = z.infer<typeof CreateEnrollmentSchema>;

export const CreateSubjectSchema = z.object({
  name: nameField,
  level: z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO']),
  institutionId: uuidField,
});
export type CreateSubjectDTO = z.infer<typeof CreateSubjectSchema>;

export const CreateCourseSectionSchema = z.object({
  name: z.string().min(1).max(100),
  grade: codeField.optional(),
  division: codeField.optional(),
  level: z.enum(['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO']),
  academicYear: z.string().length(4).regex(/^\d+$/, 'Año inválido'),
  institutionId: uuidField,
});
export type CreateCourseSectionDTO = z.infer<typeof CreateCourseSectionSchema>;

export const CreateSubjectAssignmentSchema = z.object({
  subjectId: uuidField,
  teacherId: uuidField,
  courseSectionId: uuidField,
});
export type CreateSubjectAssignmentDTO = z.infer<typeof CreateSubjectAssignmentSchema>;

export const CreateGradeSchema = z.object({
  studentId: uuidField,
  subjectId: uuidField,
  courseSectionId: uuidField,
  period: codeField,
  numericValue: z.number().optional(),
  qualitativeValue: z.string().max(100).optional(),
  status: codeField.optional(),
});
export type CreateGradeDTO = z.infer<typeof CreateGradeSchema>;

export const CreateAttendanceSchema = z.object({
  studentId: uuidField,
  courseSectionId: uuidField,
  date: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
  note: z.string().max(300).optional(),
});
export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;

// Legacy classes for controller compatibility
export class RegisterRequest { email!: string; password!: string; name!: string; role?: string; institutionId?: string; }
