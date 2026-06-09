import { Id } from '../../shared/value-objects/id';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreateSubjectPeriodGradeInput {
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  periodOrdinal: number;
}

export interface ReconstructSubjectPeriodGradeProps {
  id: string;
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  periodOrdinal: number;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: GradeInternalStatusValue | null;
  pa: boolean;
  ppi: boolean;
  pp: boolean;
}

interface SubjectPeriodGradeProps {
  id: string;
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  periodOrdinal: number;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: GradeInternalStatusValue | null;
  pa: boolean;
  ppi: boolean;
  pp: boolean;
}

// ─── Assign grade input ───────────────────────────────────────────────────────

export interface AssignSubjectPeriodGradeInput {
  gradeScaleValueId: string;
  gradeCode: string;
  internalStatus: GradeInternalStatusValue;
}

// ─── SetFlags input ───────────────────────────────────────────────────────────

export interface SetFlagsInput {
  pa?: boolean;
  ppi?: boolean;
  pp?: boolean;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Alphanumeric subject-level period grade row + per-period pedagogical flags (AD-3).
 * Mirrors the CompetencyPeriodValuation pattern.
 * Grade fields are lazy-created as null; flags default to false.
 */
export class SubjectPeriodGrade {
  private constructor(private readonly props: SubjectPeriodGradeProps) {}

  // ── Factories ──────────────────────────────────────────────────────────────

  /**
   * Lazy-creates an ungraded row. All grade fields null, pa/ppi/pp false.
   */
  static create(input: CreateSubjectPeriodGradeInput): SubjectPeriodGrade {
    return new SubjectPeriodGrade({
      id: Id.create().get(),
      studentId: input.studentId,
      courseCycleId: input.courseCycleId,
      subjectId: input.subjectId,
      periodOrdinal: input.periodOrdinal,
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      pa: false,
      ppi: false,
      pp: false,
    });
  }

  static reconstruct(props: ReconstructSubjectPeriodGradeProps): SubjectPeriodGrade {
    return new SubjectPeriodGrade({ ...props });
  }

  // ── Behavior ──────────────────────────────────────────────────────────────

  /**
   * Assigns grade fields. gradeCode must be non-empty.
   */
  assignGrade(input: AssignSubjectPeriodGradeInput): Result<void, ValidationError> {
    if (!input.gradeCode || !input.gradeCode.trim()) {
      return err(new ValidationError('gradeCode must not be empty when assigning a grade'));
    }
    this.props.gradeScaleValueId = input.gradeScaleValueId;
    this.props.gradeCode = input.gradeCode;
    this.props.internalStatus = input.internalStatus;
    return ok(undefined);
  }

  /**
   * Clears all grade snapshot fields. Flags are preserved.
   */
  clearGrade(): Result<void, never> {
    this.props.gradeScaleValueId = null;
    this.props.gradeCode = null;
    this.props.internalStatus = null;
    return ok(undefined);
  }

  /**
   * Updates pedagogical flags independently. Omitted fields retain their prior value (PPF-R4).
   */
  setFlags(input: SetFlagsInput): Result<void, never> {
    if (input.pa !== undefined) this.props.pa = input.pa;
    if (input.ppi !== undefined) this.props.ppi = input.ppi;
    if (input.pp !== undefined) this.props.pp = input.pp;
    return ok(undefined);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get id(): string { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get subjectId(): string { return this.props.subjectId; }
  get periodOrdinal(): number { return this.props.periodOrdinal; }
  get gradeScaleValueId(): string | null { return this.props.gradeScaleValueId; }
  get gradeCode(): string | null { return this.props.gradeCode; }
  get internalStatus(): GradeInternalStatusValue | null { return this.props.internalStatus; }
  get pa(): boolean { return this.props.pa; }
  get ppi(): boolean { return this.props.ppi; }
  get pp(): boolean { return this.props.pp; }
}
