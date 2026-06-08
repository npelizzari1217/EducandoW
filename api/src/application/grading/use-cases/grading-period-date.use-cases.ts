import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  GradingPeriodDate,
  GradingPeriodRepository,
  AcademicCycleRepository,
  PeriodDateInvalidRangeError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
} from '@educandow/domain';
import { DomainError } from '@educandow/domain';

// ─────────────────────────────────────────────────────────────
// Upsert period dates
// ─────────────────────────────────────────────────────────────

export interface UpsertPeriodDateInput {
  itemId: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class UpsertPeriodDatesUseCase {
  constructor(
    private readonly periodRepo: GradingPeriodRepository,
    private readonly cycleRepo: AcademicCycleRepository,
  ) {}

  async execute(
    templateId: string,
    cycleId: string,
    datesInput: UpsertPeriodDateInput[],
  ): Promise<
    Result<
      GradingPeriodDate[],
      | PeriodDateInvalidRangeError
      | PeriodDateOutOfCycleRangeError
      | PeriodDateOverlapError
      | DomainError
    >
  > {
    // 1. Load cycle to get range
    const cycle = await this.cycleRepo.findByUuid(cycleId);
    if (!cycle) {
      // If cycle not found we can't validate range — fail with a generic domain error
      return err({
        message: `AcademicCycle with uuid "${cycleId}" not found`,
        code: 'CYCLE_NOT_FOUND',
        statusCode: 404,
      } as unknown as DomainError);
    }

    // 2. Load already-persisted dates for this template+cycle (cross-batch overlap check).
    //    Exclude items that are being updated in this batch — their old version is being replaced,
    //    so validating the new version against itself would be a false positive.
    const existingDates = await this.periodRepo.findDatesByCycle(templateId, cycleId);
    const incomingItemIds = new Set(datesInput.map((d) => d.itemId));
    const persistedOtherDates = existingDates.filter((d) => !incomingItemIds.has(d.itemId));

    // 3. Validate and create all dates (sequential — each item uses persisted-other + previously
    //    validated-in-batch as siblings to detect both cross-batch and within-batch overlaps)
    const validated: GradingPeriodDate[] = [];
    for (const input of datesInput) {
      let periodDate: GradingPeriodDate;
      try {
        periodDate = GradingPeriodDate.create(
          { itemId: input.itemId, cycleId, startDate: input.startDate, endDate: input.endDate },
          cycle.startDate,
          cycle.endDate,
          [...persistedOtherDates, ...validated], // siblings = persisted others + already validated in batch
        );
      } catch (e) {
        return err(e as DomainError);
      }
      validated.push(periodDate);
    }

    // 4. Persist all validated dates
    for (const date of validated) {
      await this.periodRepo.saveDates(date.itemId, date.cycleId, {
        startDate: date.startDate,
        endDate: date.endDate,
      });
    }

    return ok(validated);
  }
}

// ─────────────────────────────────────────────────────────────
// List period dates
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ListPeriodDatesUseCase {
  constructor(private readonly periodRepo: GradingPeriodRepository) {}

  async execute(templateId: string, cycleId: string): Promise<GradingPeriodDate[]> {
    return this.periodRepo.listDates(templateId, cycleId);
  }
}
