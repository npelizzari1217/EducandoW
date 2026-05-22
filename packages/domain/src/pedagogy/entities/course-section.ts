import { Id } from '../../shared/value-objects/id';

export interface CourseSectionProps {
  id: Id;
  name: string;
  grade?: string;
  division?: string;
  level: string;
  academicYear: string;
  institutionId: string;
}

export class CourseSection {
  private constructor(private props: CourseSectionProps) {}

  static create(props: Omit<CourseSectionProps, 'id'>): CourseSection {
    return new CourseSection({ ...props, id: Id.create() });
  }

  static reconstruct(props: CourseSectionProps): CourseSection {
    return new CourseSection(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get grade(): string | undefined { return this.props.grade; }
  get division(): string | undefined { return this.props.division; }
  get level(): string { return this.props.level; }
  get academicYear(): string { return this.props.academicYear; }
  get institutionId(): string { return this.props.institutionId; }
}
