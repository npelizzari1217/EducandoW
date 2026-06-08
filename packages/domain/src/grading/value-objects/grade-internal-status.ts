import { Result, ok, err } from '../../shared/result';
import { InvalidInternalStatusError } from '../errors/grade-scale.errors';

export type GradeInternalStatusValue = 'APROBADO' | 'NO_APROBADO' | 'EN_PROCESO' | 'LIBRE';

const VALID_STATUSES = new Set<string>(['APROBADO', 'NO_APROBADO', 'EN_PROCESO', 'LIBRE']);

export class GradeInternalStatus {
  private constructor(private readonly value: GradeInternalStatusValue) {}

  static create(raw: string): Result<GradeInternalStatus, InvalidInternalStatusError> {
    if (!raw || !VALID_STATUSES.has(raw)) {
      return err(new InvalidInternalStatusError(raw));
    }
    return ok(new GradeInternalStatus(raw as GradeInternalStatusValue));
  }

  static reconstruct(value: GradeInternalStatusValue): GradeInternalStatus {
    return new GradeInternalStatus(value);
  }

  get(): GradeInternalStatusValue {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: GradeInternalStatus): boolean {
    return this.value === other.value;
  }
}
