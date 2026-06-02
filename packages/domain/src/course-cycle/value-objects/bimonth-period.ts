import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export class BimonthPeriod {
  private constructor(
    private readonly _start: Date,
    private readonly _end: Date,
  ) {}

  static create(start: Date, end: Date): Result<BimonthPeriod, ValidationError> {
    if (end.getTime() <= start.getTime()) {
      return err(new ValidationError('End date must be after start date'));
    }
    return ok(new BimonthPeriod(start, end));
  }

  static reconstruct(start: Date, end: Date): BimonthPeriod {
    return new BimonthPeriod(start, end);
  }

  get start(): Date {
    return this._start;
  }

  get end(): Date {
    return this._end;
  }

  equals(other: BimonthPeriod): boolean {
    return this._start.getTime() === other._start.getTime()
      && this._end.getTime() === other._end.getTime();
  }
}
