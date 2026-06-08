import { Result, ok, err } from '../../shared/result';
import { PeriodSortOrderInvalidError } from '../errors/grading-period.errors';

export class PeriodSortOrder {
  private constructor(private readonly value: number) {}

  static create(raw: number): Result<PeriodSortOrder, PeriodSortOrderInvalidError> {
    if (!Number.isInteger(raw) || raw < 1) {
      return err(new PeriodSortOrderInvalidError(raw));
    }
    return ok(new PeriodSortOrder(raw));
  }

  static reconstruct(value: number): PeriodSortOrder {
    return new PeriodSortOrder(value);
  }

  get(): number {
    return this.value;
  }

  equals(other: PeriodSortOrder): boolean {
    return this.value === other.value;
  }
}
