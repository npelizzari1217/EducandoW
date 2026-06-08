import type { CompetencyPeriodValuation } from '../entities/competency-period-valuation';

export interface CompetencyPeriodValuationRepository {
  /** Returns the child row for a given (valuationId, periodItemId) pair, or null if not yet created. */
  findByValuationAndPeriod(valuationId: string, periodItemId: string): Promise<CompetencyPeriodValuation | null>;

  /** Upserts the child row keyed by (valuationId, periodItemId). */
  save(child: CompetencyPeriodValuation): Promise<void>;

  /** Returns all period children for a given parent valuation. Used for Fase-4 reads — no route yet. */
  listByValuation(valuationId: string): Promise<CompetencyPeriodValuation[]>;
}
