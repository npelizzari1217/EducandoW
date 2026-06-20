import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { ObservationType, ObservationTypeValue } from '../value-objects/observation-type';

export interface StudentObservationProps {
  id: Id;
  studentId: Id;
  authorId: Id;
  type: ObservationType;
  content: string;
  /** AcademicCycle uuid. Required for PEDAGOGICAL; forbidden for PSYCHOPEDAGOGICAL. (ADR-3) */
  academicCycleId?: Id;
  createdAt?: Date;
  deletedAt?: Date;
}

export class StudentObservation {
  private constructor(private props: StudentObservationProps) {}

  static create(
    props: Omit<StudentObservationProps, 'id'>,
  ): Result<StudentObservation, ValidationError> {
    if (!props.content || props.content.length < 1 || props.content.length > 2000) {
      return err(new ValidationError('Observation content must be between 1 and 2000 characters'));
    }

    if (props.type.value === ObservationTypeValue.PEDAGOGICAL && !props.academicCycleId) {
      return err(new ValidationError('Pedagogical observations require an academic cycle'));
    }

    if (props.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL && props.academicCycleId) {
      return err(new ValidationError('Psychopedagogical observations cannot be linked to an academic cycle'));
    }

    return ok(
      new StudentObservation({
        ...props,
        id: Id.create(),
      }),
    );
  }

  static reconstruct(props: StudentObservationProps): StudentObservation {
    return new StudentObservation(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): Id { return this.props.studentId; }
  get authorId(): Id { return this.props.authorId; }
  get type(): ObservationType { return this.props.type; }
  get content(): string { return this.props.content; }
  /** AcademicCycle uuid. Set for PEDAGOGICAL observations; undefined for PSYCHOPEDAGOGICAL. */
  get academicCycleId(): Id | undefined { return this.props.academicCycleId; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  isAuthoredBy(userId: Id): boolean {
    return this.props.authorId.equals(userId);
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
  }
}
