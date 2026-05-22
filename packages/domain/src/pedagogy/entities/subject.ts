import { Id } from '../../shared/value-objects/id';

export interface SubjectProps {
  id: Id;
  name: string;
  level: string;
  institutionId: string;
}

export class Subject {
  private constructor(private props: SubjectProps) {}

  static create(props: Omit<SubjectProps, 'id'>): Subject {
    return new Subject({ ...props, id: Id.create() });
  }

  static reconstruct(props: SubjectProps): Subject {
    return new Subject(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): string { return this.props.level; }
  get institutionId(): string { return this.props.institutionId; }
}
