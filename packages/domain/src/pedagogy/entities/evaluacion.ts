import { Id } from '../../shared/value-objects/id';

export interface EvaluacionProps {
  id: Id;
  assignmentId: string;
  title: string;
  description?: string;
  evaluationDate: Date;
  weight: number;
  active?: boolean;
  deletedAt?: Date;
}

export class Evaluacion {
  private constructor(private props: EvaluacionProps) {}

  static create(props: Omit<EvaluacionProps, 'id' | 'weight' | 'active' | 'deletedAt'> & { weight?: number }): Evaluacion {
    return new Evaluacion({ ...props, weight: props.weight ?? 1, id: Id.create(), active: true });
  }

  static reconstruct(props: EvaluacionProps): Evaluacion {
    return new Evaluacion(props);
  }

  get id(): Id { return this.props.id; }
  get assignmentId(): string { return this.props.assignmentId; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get evaluationDate(): Date { return this.props.evaluationDate; }
  get weight(): number { return this.props.weight; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
