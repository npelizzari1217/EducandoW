import { Id } from '../../shared/value-objects/id';
import { Level, LevelType } from '../../institution/value-objects/level';

export interface SubjectProps {
  id: Id;
  name: string;
  level: Level;
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
  get level(): Level { return this.props.level; }
  /** Código del nivel como LevelType para queries. */
  get levelCode(): LevelType { return this.props.level.get(); }
  get institutionId(): string { return this.props.institutionId; }
}
