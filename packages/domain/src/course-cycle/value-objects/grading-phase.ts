import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export type GradingPhaseCode = 'BIM_1' | 'BIM_2' | 'BIM_3' | 'BIM_4' | 'CIERRE';

const CATALOG: GradingPhaseCode[] = ['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE'];

const BIMESTER_ORDINAL: Record<string, number> = {
  BIM_1: 1,
  BIM_2: 2,
  BIM_3: 3,
  BIM_4: 4,
};

/**
 * Represents an ACTIVE grading phase for a Primario/Secundario CourseCycle.
 * Absence of a phase (not yet activated / cutover) is modeled as `null` in the
 * entity, never as a value of this VO.
 */
export class GradingPhase {
  private constructor(private readonly value: GradingPhaseCode) {}

  static create(value: string): Result<GradingPhase, ValidationError> {
    if (!CATALOG.includes(value as GradingPhaseCode)) {
      return err(new ValidationError(
        `Invalid grading phase: "${value}". Valid: ${CATALOG.join(', ')}`,
      ));
    }
    return ok(new GradingPhase(value as GradingPhaseCode));
  }

  static reconstruct(value: GradingPhaseCode): GradingPhase {
    return new GradingPhase(value);
  }

  get code(): GradingPhaseCode {
    return this.value;
  }

  isCierre(): boolean {
    return this.value === 'CIERRE';
  }

  isBimester(): boolean {
    return this.value !== 'CIERRE';
  }

  bimesterOrdinal(): number | null {
    return BIMESTER_ORDINAL[this.value] ?? null;
  }

  equals(other: GradingPhase): boolean {
    return this.value === other.value;
  }
}
