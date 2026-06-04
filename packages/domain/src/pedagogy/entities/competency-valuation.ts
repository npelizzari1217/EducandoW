import { Id } from '../../shared/value-objects/id';

export interface CompetencyValuationProps {
  id: Id;
  competencyId: string;
  studentId: string;
  valuation1: string | null;
  valuation2: string | null;
  valuation3: string | null;
  valuation4: string | null;
  modificable1: boolean;
  modificable2: boolean;
  modificable3: boolean;
  modificable4: boolean;
  imprimible1: boolean;
  imprimible2: boolean;
  imprimible3: boolean;
  imprimible4: boolean;
  periodActive: number;
  active?: boolean;
  deletedAt?: Date;
}

export class CompetencyValuation {
  private constructor(private props: CompetencyValuationProps) {}

  static create(props: Omit<CompetencyValuationProps, 'id' | 'active' | 'deletedAt'>): CompetencyValuation {
    return new CompetencyValuation({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: CompetencyValuationProps): CompetencyValuation {
    return new CompetencyValuation(props);
  }

  get id(): Id { return this.props.id; }
  get competencyId(): string { return this.props.competencyId; }
  get studentId(): string { return this.props.studentId; }

  get valuation1(): string | null { return this.props.valuation1; }
  get valuation2(): string | null { return this.props.valuation2; }
  get valuation3(): string | null { return this.props.valuation3; }
  get valuation4(): string | null { return this.props.valuation4; }

  get modificable1(): boolean { return this.props.modificable1; }
  get modificable2(): boolean { return this.props.modificable2; }
  get modificable3(): boolean { return this.props.modificable3; }
  get modificable4(): boolean { return this.props.modificable4; }

  get imprimible1(): boolean { return this.props.imprimible1; }
  get imprimible2(): boolean { return this.props.imprimible2; }
  get imprimible3(): boolean { return this.props.imprimible3; }
  get imprimible4(): boolean { return this.props.imprimible4; }

  get periodActive(): number { return this.props.periodActive; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  isModificable(period: 1 | 2 | 3 | 4): boolean {
    return this.props[`modificable${period}`];
  }

  setValuation(period: 1 | 2 | 3 | 4, value: string | null): void {
    (this.props as unknown as Record<string, unknown>)[`valuation${period}`] = value;
  }

  setModificable(period: 1 | 2 | 3 | 4, value: boolean): void {
    (this.props as unknown as Record<string, unknown>)[`modificable${period}`] = value;
  }

  setImprimible(period: 1 | 2 | 3 | 4, value: boolean): void {
    (this.props as unknown as Record<string, unknown>)[`imprimible${period}`] = value;
  }

  setPeriodActive(period: number): void {
    this.props.periodActive = period;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
