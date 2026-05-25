import { Id } from '../../shared/value-objects/id';

export interface NotaTrimestralProps {
  id: Id;
  studentId: string;
  assignmentId: string;
  periodId: string;
  finalGrade: number;
  attendancePct?: number;
  active?: boolean;
  deletedAt?: Date;
}

export class NotaTrimestral {
  private constructor(private props: NotaTrimestralProps) {}

  static create(props: Omit<NotaTrimestralProps, 'id' | 'active' | 'deletedAt'>): NotaTrimestral {
    return new NotaTrimestral({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: NotaTrimestralProps): NotaTrimestral {
    return new NotaTrimestral(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get assignmentId(): string { return this.props.assignmentId; }
  get periodId(): string { return this.props.periodId; }
  get finalGrade(): number { return this.props.finalGrade; }
  get attendancePct(): number | undefined { return this.props.attendancePct; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
