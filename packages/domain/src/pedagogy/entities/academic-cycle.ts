import { Id } from '../../shared/value-objects/id';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';

export interface AcademicCycleProps {
  id: Id;
  name: string;
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AcademicCycle {
  private constructor(private props: AcademicCycleProps) {}

  static reconstruct(props: AcademicCycleProps): AcademicCycle {
    return new AcademicCycle(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): EducationalLevelCode { return this.props.level; }
  get modality(): EducationalModalityCode { return this.props.modality; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date { return this.props.endDate; }
  get active(): boolean { return this.props.active; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isCurrent(): boolean {
    const now = new Date();
    return this.props.active && this.props.startDate <= now && this.props.endDate >= now;
  }
}
