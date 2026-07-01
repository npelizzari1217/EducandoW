/**
 * DTOs for Asistencia Mensual print endpoints (PR3c).
 *
 * Endpoints:
 *   GET /course-cycles/:ccId/asistencia-mensual/print?year=&month=
 *   GET /materias-curso-ciclo/:materiaId/asistencia-mensual/print?year=&month=&grupoId=
 */
import { z } from 'zod';

export const AsistenciaMensualPrintGeneralQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type AsistenciaMensualPrintGeneralQueryDto = z.infer<typeof AsistenciaMensualPrintGeneralQuerySchema>;

export const AsistenciaMensualPrintMateriaQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  grupoId: z.string().uuid().optional(),
});

export type AsistenciaMensualPrintMateriaQueryDto = z.infer<typeof AsistenciaMensualPrintMateriaQuerySchema>;
