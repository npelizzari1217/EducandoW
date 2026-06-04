import { Result, ok, err } from '../result';
import { ValidationError } from '../errors/validation-error';

export type PeriodType = 'BIMESTER' | 'TRIMESTER';

export class GradingPeriod {
  private constructor(
    private readonly _value: number,
    private readonly _periodType: PeriodType,
  ) {}

  static create(value: number, periodType: PeriodType = 'BIMESTER'): Result<GradingPeriod, ValidationError> {
    const max = periodType === 'BIMESTER' ? 4 : 3;
    if (!Number.isInteger(value) || value < 1 || value > max) {
      return err(new ValidationError(
        `Grading period must be an integer between 1 and ${max} for ${periodType}, got ${value}`,
      ));
    }
    return ok(new GradingPeriod(value, periodType));
  }

  static reconstruct(value: number, periodType: PeriodType = 'BIMESTER'): GradingPeriod {
    return new GradingPeriod(value, periodType);
  }

  get value(): number {
    return this._value;
  }

  get periodType(): PeriodType {
    return this._periodType;
  }

  equals(other: GradingPeriod): boolean {
    return this._value === other._value
      && this._periodType === other._periodType;
  }
}
