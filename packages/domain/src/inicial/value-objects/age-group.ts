import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const VALID_AGE_GROUPS = [3, 4, 5] as const;
export type AgeGroupValue = typeof VALID_AGE_GROUPS[number];

export class AgeGroup {
  private constructor(private readonly value: AgeGroupValue) {}

  static create(value: number): Result<AgeGroup, ValidationError> {
    if (!VALID_AGE_GROUPS.includes(value as AgeGroupValue)) {
      return err(new ValidationError(`AgeGroup must be 3, 4, or 5. Got: ${value}`));
    }
    return ok(new AgeGroup(value as AgeGroupValue));
  }

  static reconstruct(value: number): AgeGroup {
    return new AgeGroup(value as AgeGroupValue);
  }

  get(): AgeGroupValue {
    return this.value;
  }

  equals(other: AgeGroup): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
