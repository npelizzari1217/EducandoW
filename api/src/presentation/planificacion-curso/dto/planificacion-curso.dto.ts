import { z } from 'zod';

export const CreatePlanificacionCursoSchema = z.object({
  nombre: z.string().min(1, 'El nombre no puede estar vacío').trim(),
  periodOrdinal: z.number().int().min(1).optional(),
  descripcion: z.string().optional(),
});
export type CreatePlanificacionCursoDto = z.infer<typeof CreatePlanificacionCursoSchema>;

export const UpdatePlanificacionCursoSchema = z.object({
  nombre: z.string().min(1).trim().optional(),
  periodOrdinal: z.number().int().min(1).nullable().optional(),
  descripcion: z.string().nullable().optional(),
});
export type UpdatePlanificacionCursoDto = z.infer<typeof UpdatePlanificacionCursoSchema>;

export interface PlanificacionCursoResponse {
  id: string;
  asignacionCursoId: string;
  nombre: string;
  periodOrdinal?: number;
  descripcion?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
