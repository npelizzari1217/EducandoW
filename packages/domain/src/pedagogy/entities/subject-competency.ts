import { Id } from '../../shared/value-objects/id';

export interface SubjectCompetencyProps {
  id: Id;
  subjectId: string;
  name: string;
  periodActive: number;
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
  get subjectId(): string { return this.props.subjectId; }
  get name(): string { return this.props.name; }
  get periodActive(): number { return this.props.periodActive; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  updateName(name: string): void {
    this.props.name = name;
  }

  setActive(active: boolean): void {
    this.props.active = active;
  }

  setPeriodActive(period: number): void {
    this.props.periodActive = period;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
