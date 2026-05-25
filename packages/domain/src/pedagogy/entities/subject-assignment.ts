import { Id } from '../../shared/value-objects/id';

export interface SubjectAssignmentProps {
  id: Id;
  subjectId: string;
  teacherId: string;
  courseSectionId: string;
  active?: boolean;
  deletedAt?: Date;
}

export class SubjectAssignment {
  private constructor(private props: SubjectAssignmentProps) {}

  static create(props: Omit<SubjectAssignmentProps, 'id' | 'active' | 'deletedAt'>): SubjectAssignment {
    return new SubjectAssignment({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: SubjectAssignmentProps): SubjectAssignment {
    return new SubjectAssignment(props);
  }

  get id(): Id { return this.props.id; }
  get subjectId(): string { return this.props.subjectId; }
  get teacherId(): string { return this.props.teacherId; }
  get courseSectionId(): string { return this.props.courseSectionId; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
