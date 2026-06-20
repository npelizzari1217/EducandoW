import type { CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo } from '../entities/competency-period-valuation';

export interface CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloRepository {
  /** Returns the child row for a given (valuationId, periodItemId) pair, or null if not yet created. */
  findByValuationAndPeriod(valuationId: string, periodItemId: string): Promise<CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo | null>;

  /** Upserts the child row keyed by (valuationId, periodItemId). */
  save(child: CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo): Promise<void>;

  /** Returns all period children for a given parent valuation. Used for Fase-4 reads — no route yet. */
  listByValuation(valuationId: string): Promise<CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo[]>;
}
