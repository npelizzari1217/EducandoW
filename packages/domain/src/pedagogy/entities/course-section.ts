import { Id } from '../../shared/value-objects/id';
import { Level, LevelType } from '../../institution/value-objects/level';

export interface CourseSectionProps {
  id: Id;
  name: string;
  grade?: string;
  division?: string;
  level: Level;
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
  get level(): Level { return this.props.level; }
  /** Código del nivel como LevelType para queries. */
  get levelCode(): LevelType { return this.props.level.get(); }
  get academicYear(): string { return this.props.academicYear; }
  get institutionId(): string { return this.props.institutionId; }
}
