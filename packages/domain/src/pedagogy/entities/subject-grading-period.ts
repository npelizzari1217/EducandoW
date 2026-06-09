import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SnapshotSubjectGradingPeriodInput {
  courseCycleId: string;
  subjectId: string;
  /** = GradingPeriodTemplateItem.sortOrder at snapshot time */
  sortOrder: number;
  /** = GradingPeriodTemplateItem.name at snapshot time */
  name: string;
}

export interface ReconstructSubjectGradingPeriodProps {
  id: string;
  courseCycleId: string;
  subjectId: string;
  periodOrdinal: number;
  periodName: string;
}

interface SubjectGradingPeriodProps {
  id: string;
  courseCycleId: string;
  subjectId: string;
  /** Immutable snapshot of sortOrder */
  periodOrdinal: number;
  /** Immutable snapshot of the period name */
  periodName: string;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Immutable snapshot of one period slot for a (CourseCycle × Subject) pair.
 * Created once per GradingPeriodTemplateItem on the first grade-screen read.
 * After creation no mutation is possible.
 */
export class SubjectGradingPeriod {
  private constructor(private readonly props: SubjectGradingPeriodProps) {}

  // ── Factories ──────────────────────────────────────────────────────────────

  /**
   * Creates a snapshot from a GradingPeriodTemplateItem.
   * @throws ValidationError if sortOrder < 1 or name is empty/whitespace.
   */
  static snapshotFromTemplateItem(input: SnapshotSubjectGradingPeriodInput): SubjectGradingPeriod {
    if (input.sortOrder < 1) {
      throw new ValidationError(
        `periodOrdinal must be ≥ 1, received ${input.sortOrder}`,
      );
    }
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError('periodName must not be empty or whitespace');
    }
    return new SubjectGradingPeriod({
      id: Id.create().get(),
      courseCycleId: input.courseCycleId,
      subjectId: input.subjectId,
      periodOrdinal: input.sortOrder,
      periodName: trimmedName,
    });
  }

  static reconstruct(props: ReconstructSubjectGradingPeriodProps): SubjectGradingPeriod {
    return new SubjectGradingPeriod({ ...props });
  }

  // ── Getters (no setters — immutable) ──────────────────────────────────────

  get id(): string { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get subjectId(): string { return this.props.subjectId; }
  get periodOrdinal(): number { return this.props.periodOrdinal; }
  get periodName(): string { return this.props.periodName; }
}
