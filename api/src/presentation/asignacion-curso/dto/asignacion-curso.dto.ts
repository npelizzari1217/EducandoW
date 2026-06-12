import { z } from 'zod';
import { RolCurso, TurnoCurso } from '@educandow/domain';

// ── AssignDocenteToCurso (F4-P1) ──────────────────────────────────────────────

export const AssignDocenteToCursoSchema = z.object({
  /** Master-DB User.id of the person being assigned. */
  userId: z.string().uuid(),
  /** AcademicCycle UUID of the CursoXCiclo — required for cycle-scope validation. */
  cycleId: z.string().uuid(),
  rol: z.nativeEnum(RolCurso),
  /** Shift — optional and informational (D2: no uniqueness constraint). */
  turno: z.nativeEnum(TurnoCurso).optional(),
});
export type AssignDocenteToCursoDto = z.infer<typeof AssignDocenteToCursoSchema>;

// ── Response types (F4-P4) ────────────────────────────────────────────────────

export interface AsignacionCursoResponse {
  id: string;
  courseCycleId: string;
  docenteXCicloId: string;
  rol: RolCurso;
  turno?: TurnoCurso;
  createdAt: string;
}
