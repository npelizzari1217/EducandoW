import { Id } from '../../shared/value-objects/id';

export interface SubjectCompetencyProps {
  id: Id;
  studyPlanSubjectId: string;
  name: string;
  active?: boolean;
  deletedAt?: Date;
}

export class SubjectCompetency {
  private constructor(private props: SubjectCompetencyProps) {}

  static create(props: Omit<SubjectCompetencyProps, 'id' | 'active' | 'deletedAt'>): SubjectCompetency {
    return new SubjectCompetency({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: SubjectCompetencyProps): SubjectCompetency {
    return new SubjectCompetency(props);
  }

  get id(): Id { return this.props.id; }
  get studyPlanSubjectId(): string { return this.props.studyPlanSubjectId; }
  get name(): string { return this.props.name; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  updateName(name: string): void {
    this.props.name = name;
  }

  setActive(active: boolean): void {
    this.props.active = active;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
