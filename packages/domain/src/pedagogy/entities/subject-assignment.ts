import { Id } from '../../shared/value-objects/id';

export interface SubjectAssignmentProps {
  id: Id;
  subjectId: string;
  teacherId: string;
  courseSectionId: string;
}

export class SubjectAssignment {
  private constructor(private props: SubjectAssignmentProps) {}

  static create(props: Omit<SubjectAssignmentProps, 'id'>): SubjectAssignment {
    return new SubjectAssignment({ ...props, id: Id.create() });
  }

  static reconstruct(props: SubjectAssignmentProps): SubjectAssignment {
    return new SubjectAssignment(props);
  }

  get id(): Id { return this.props.id; }
  get subjectId(): string { return this.props.subjectId; }
  get teacherId(): string { return this.props.teacherId; }
  get courseSectionId(): string { return this.props.courseSectionId; }
}
