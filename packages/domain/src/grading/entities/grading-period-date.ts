import { Id } from '../../shared/value-objects/id';
import {
  PeriodDateInvalidRangeError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
} from '../errors/grading-period.errors';

export interface CreateGradingPeriodDateInput {
  itemId: string;
  cycleId: string;
  startDate: Date;
  endDate: Date;
}

export interface ReconstructGradingPeriodDateProps {
  id: string;
  itemId: string;
  cycleId: string;
  startDate: Date;
  endDate: Date;
}

interface GradingPeriodDateProps {
  id: string;
  itemId: string;
  cycleId: string;
  startDate: Date;
  endDate: Date;
}

export class GradingPeriodDate {
  private constructor(private readonly props: GradingPeriodDateProps) {}

  /**
   * Create a GradingPeriodDate with full validation.
   *
   * Invariants enforced here:
   *   1. startDate < endDate (PeriodDateInvalidRangeError)
   *   2. startDate >= cycleStart && endDate <= cycleEnd (PeriodDateOutOfCycleRangeError)
   *   3. No overlap with any sibling in the same cycle (PeriodDateOverlapError)
   *
   * Gaps between periods are explicitly ALLOWED — no min-coverage validation.
   * Overlap check: [a, b) overlaps [c, d) if a < d && c < b.
   */
  static create(
    input: CreateGradingPeriodDateInput,
    cycleStart: Date,
    cycleEnd: Date,
    siblings: GradingPeriodDate[],
  ): GradingPeriodDate {
    const { startDate, endDate } = input;

    // Invariant 1: startDate must be strictly before endDate
    if (startDate >= endDate) {
      throw new PeriodDateInvalidRangeError(startDate, endDate);
    }

    // Invariant 2: must be within cycle range
    if (startDate < cycleStart || endDate > cycleEnd) {
      throw new PeriodDateOutOfCycleRangeError(
        startDate < cycleStart ? startDate : endDate,
        cycleStart,
        cycleEnd,
      );
    }

    // Invariant 3: no overlap with siblings
    for (const sibling of siblings) {
      const overlaps = startDate < sibling.endDate && sibling.startDate < endDate;
      if (overlaps) {
        throw new PeriodDateOverlapError(input.itemId, sibling.itemId);
      }
    }

    return new GradingPeriodDate({
      id: Id.create().get(),
      itemId: input.itemId,
      cycleId: input.cycleId,
      startDate,
      endDate,
    });
  }

  static reconstruct(props: ReconstructGradingPeriodDateProps): GradingPeriodDate {
    return new GradingPeriodDate(props);
  }

  get id(): string { return this.props.id; }
  get itemId(): string { return this.props.itemId; }
  get cycleId(): string { return this.props.cycleId; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date { return this.props.endDate; }
}
