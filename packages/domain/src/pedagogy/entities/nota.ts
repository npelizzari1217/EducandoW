import { Id } from '../../shared/value-objects/id';

export interface NotaProps {
  id: Id;
  evaluationId: string;
  studentId: string;
  numericValue?: number;
  qualitativeValue?: string;
  comments?: string;
  registeredAt: Date;
  active?: boolean;
  deletedAt?: Date;

  // FK to the grade scale value (for current reference)
  gradeScaleValueId?: string;

  // SNAPSHOT — immutable historical record
  gradeCode?: string;
  gradeLabel?: string;
  isApproved?: boolean;
}

export class Nota {
  private constructor(private props: NotaProps) {}

  static create(props: Omit<NotaProps, 'id' | 'registeredAt' | 'active' | 'deletedAt'>): Nota {
    return new Nota({ ...props, id: Id.create(), registeredAt: new Date(), active: true });
  }

  static reconstruct(props: NotaProps): Nota {
    return new Nota(props);
  }

  get id(): Id { return this.props.id; }
  get evaluationId(): string { return this.props.evaluationId; }
  get studentId(): string { return this.props.studentId; }
  get numericValue(): number | undefined { return this.props.numericValue; }
  get qualitativeValue(): string | undefined { return this.props.qualitativeValue; }
  get comments(): string | undefined { return this.props.comments; }
  get registeredAt(): Date { return this.props.registeredAt; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  get gradeScaleValueId(): string | undefined { return this.props.gradeScaleValueId; }
  get gradeCode(): string | undefined { return this.props.gradeCode; }
  get gradeLabel(): string | undefined { return this.props.gradeLabel; }
  get isApproved(): boolean | undefined { return this.props.isApproved; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
