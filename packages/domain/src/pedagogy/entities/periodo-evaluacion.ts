import { Id } from '../../shared/value-objects/id';

export interface PeriodoEvaluacionProps {
  id: Id;
  academicYear: string;
  name: string;
  startDate: Date;
  endDate: Date;
  active?: boolean;
  deletedAt?: Date;
}

export class PeriodoEvaluacion {
  private constructor(private props: PeriodoEvaluacionProps) {}

  static create(props: Omit<PeriodoEvaluacionProps, 'id' | 'active' | 'deletedAt'>): PeriodoEvaluacion {
    return new PeriodoEvaluacion({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: PeriodoEvaluacionProps): PeriodoEvaluacion {
    return new PeriodoEvaluacion(props);
  }

  get id(): Id { return this.props.id; }
  get academicYear(): string { return this.props.academicYear; }
  get name(): string { return this.props.name; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date { return this.props.endDate; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
