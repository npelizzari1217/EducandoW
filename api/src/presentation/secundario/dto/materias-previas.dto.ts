/**
 * PR5-T4 — DTOs for MateriasPrevias endpoints.
 *
 * UpsertMateriaPreviaSchema: validates the POST /students/:studentId/materias-previas body.
 *   - condicion accepts all SubjectFinalGradeCondicion values at the Zod boundary;
 *     the domain entity rejects REGULAR → 400 via use-case ValidationError.
 *
 * MateriaPreviaResponseDto: response shape for a single materia previa.
 *
 * Specs: MP-R1, MP-R6, D2
 */
import { z } from 'zod';
import { SubjectFinalGradeCondicion, MateriaPreviaStatus } from '@educandow/domain';

// ── Write-side ────────────────────────────────────────────────────────────────

export const UpsertMateriaPreviaSchema = z.object({
  subjectId: z.string().min(1, 'subjectId is required'),
  originAcademicYear: z.string().min(1, 'originAcademicYear is required'),
  condicion: z.nativeEnum(SubjectFinalGradeCondicion, {
    errorMap: () => ({
      message: `condicion must be one of: ${Object.values(SubjectFinalGradeCondicion).join(', ')}`,
    }),
  }),
  originCourseCycleId: z.string().min(1).optional(),
});

export type UpsertMateriaPreviaDto = z.infer<typeof UpsertMateriaPreviaSchema>;

// ── Query params for GET /students/:studentId/materias-previas ────────────────

export const ListMateriasPreviasQuerySchema = z.object({
  academicYear: z.string().min(1).optional(),
});

export type ListMateriasPreviasQueryDto = z.infer<typeof ListMateriasPreviasQuerySchema>;

// ── Read-side response ────────────────────────────────────────────────────────

/**
 * Response shape for a single materia previa.
 * resolvedGradeCode and resolvedAt are optional (absent when status=PENDIENTE).
 */
export interface MateriaPreviaResponseDto {
  id: string;
  studentId: string;
  subjectId: string;
  originAcademicYear: string;
  originCourseCycleId?: string;
  condicion: SubjectFinalGradeCondicion;
  status: MateriaPreviaStatus;
  resolvedGradeCode?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
