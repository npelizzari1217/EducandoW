import { Id } from '../../shared/value-objects/id';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';

export interface StudyPlanProps {
  id: Id;
  name: string;
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class StudyPlan {
  private constructor(private props: StudyPlanProps) {}

  static create(props: Omit<StudyPlanProps, 'id' | 'active' | 'deletedAt' | 'createdAt' | 'updatedAt'>): StudyPlan {
    return new StudyPlan({ ...props, id: Id.create(), active: true, createdAt: new Date(), updatedAt: new Date() });
  }

  static reconstruct(props: StudyPlanProps): StudyPlan {
    return new StudyPlan(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): EducationalLevelCode { return this.props.level; }
  get modality(): EducationalModalityCode { return this.props.modality; }
  get academicYear(): string { return this.props.academicYear; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
