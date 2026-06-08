/**
 * PR2 slim rewrite — CompetencyValuation parent entity.
 * All flat period fields (valuation1..4, modificable1..4, imprimible1..4, periodActive)
 * have been removed. Grade state now lives in CompetencyPeriodValuation children.
 * Spec: MVM-1 (parent with courseCycleId), design §4.1.
 */

import { Id } from '../../shared/value-objects/id';

export interface CompetencyValuationProps {
  id: Id;
  competencyId: string;
  studentId: string;
  courseCycleId: string;
  active?: boolean;
  deletedAt?: Date;
}

export class CompetencyValuation {
  private constructor(private props: CompetencyValuationProps) {}

  static create(props: { competencyId: string; studentId: string; courseCycleId: string }): CompetencyValuation {
    return new CompetencyValuation({
      ...props,
      id: Id.create(),
      active: true,
    });
  }

  static reconstruct(props: CompetencyValuationProps): CompetencyValuation {
    return new CompetencyValuation(props);
  }

  get id(): Id { return this.props.id; }
  get competencyId(): string { return this.props.competencyId; }
  get studentId(): string { return this.props.studentId; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
