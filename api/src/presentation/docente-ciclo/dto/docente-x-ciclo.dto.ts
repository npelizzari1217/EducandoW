import { z } from 'zod';

// ── Query ──────────────────────────────────────────────────────────────────

export const ListDocentesXCicloQuerySchema = z.object({
  cycleId: z.string().min(1, 'cycleId is required'),
});

export type ListDocentesXCicloQueryDto = z.infer<typeof ListDocentesXCicloQuerySchema>;

// ── Response ───────────────────────────────────────────────────────────────

/**
 * Response DTO for GET /docentes-x-ciclo?cycleId=
 * Persona fields sourced from master User (DC-R2, DC-S4).
 * DocenteXCiclo does NOT store persona fields — they are joined from User.
 */
export interface DocenteXCicloResponseItem {
  docenteXCicloId: string;
  userId: string;
  cycleId: string;
  active: boolean;
  // Persona from master User (DC-S4 — joined by the use-case)
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  title: string | null;
  phone: string | null;
}
