import { Id } from '../../shared/value-objects/id';
import { Result, ok, err } from '../../shared/result';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';
import { PeriodLockedError } from '../errors/competency-valuation.errors';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreateCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloInput {
  valuationId: string;
  periodItemId: string;
}

export interface ReconstructCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloProps {
  id: string;
  valuationId: string;
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: GradeInternalStatusValue | null;
  modificable: boolean;
  imprimible: boolean;
}

interface CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloProps {
  id: string;
  valuationId: string;
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: GradeInternalStatusValue | null;
  modificable: boolean;
  imprimible: boolean;
}

// ─── Assign grade input ───────────────────────────────────────────────────────

export interface AssignGradeInput {
  gradeScaleValueId: string;
  gradeCode: string;
  internalStatus: GradeInternalStatusValue;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo {
  private constructor(private readonly props: CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloProps) {}

  // ── Factories ─────────────────────────────────────────────

  /**
   * Lazy-creates an ungraded child row for a (valuation, periodItem) pair.
   * Defaults: all grade fields null, modificable=true, imprimible=false.
   */
  static create(input: CreateCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloInput): CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo {
    return new CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo({
      id: Id.create().get(),
      valuationId: input.valuationId,
      periodItemId: input.periodItemId,
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      modificable: true,
      imprimible: false,
    });
  }

  static reconstruct(props: ReconstructCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloProps): CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo {
    return new CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo({ ...props });
  }

  // ── Behavior ──────────────────────────────────────────────

  /**
   * Snapshots gradeScaleValueId, gradeCode, and internalStatus onto this child row.
   * Guards modificable=false → err(PeriodLockedError).
   * Lock check lives HERE (entity invariant), not in the use case.
   */
  assignGrade(input: AssignGradeInput): Result<void, PeriodLockedError> {
    if (!this.props.modificable) {
      return err(new PeriodLockedError(this.props.periodItemId));
    }
    this.props.gradeScaleValueId = input.gradeScaleValueId;
    this.props.gradeCode = input.gradeCode;
    this.props.internalStatus = input.internalStatus;
    return ok(undefined);
  }

  /**
   * Clears all three grade snapshot fields.
   * Guards modificable=false → err(PeriodLockedError).
   */
  clearGrade(): Result<void, PeriodLockedError> {
    if (!this.props.modificable) {
      return err(new PeriodLockedError(this.props.periodItemId));
    }
    this.props.gradeScaleValueId = null;
    this.props.gradeCode = null;
    this.props.internalStatus = null;
    return ok(undefined);
  }

  setModificable(value: boolean): void {
    this.props.modificable = value;
  }

  setImprimible(value: boolean): void {
    this.props.imprimible = value;
  }

  // ── Getters ───────────────────────────────────────────────

  get id(): string { return this.props.id; }
  get valuationId(): string { return this.props.valuationId; }
  get periodItemId(): string { return this.props.periodItemId; }
  get gradeScaleValueId(): string | null { return this.props.gradeScaleValueId; }
  get gradeCode(): string | null { return this.props.gradeCode; }
  get internalStatus(): GradeInternalStatusValue | null { return this.props.internalStatus; }
  get modificable(): boolean { return this.props.modificable; }
  get imprimible(): boolean { return this.props.imprimible; }
}
