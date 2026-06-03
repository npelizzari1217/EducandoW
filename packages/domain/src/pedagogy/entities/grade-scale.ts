import { Id } from '../../shared/value-objects/id';
import { EducationalLevel, EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModality, EducationalModalityCode } from '../../shared/value-objects/educational-modality';

export interface GradeScaleValueProps {
  id: Id;
  scaleId: Id;
  code: string;
  label: string;
  numericValue?: number;
  isApproved: boolean;
  sortOrder: number;
  active?: boolean;
  deletedAt?: Date;
}

export class GradeScaleValue {
  private constructor(private props: GradeScaleValueProps) {}

  static create(props: Omit<GradeScaleValueProps, 'id' | 'active' | 'deletedAt'>): GradeScaleValue {
    return new GradeScaleValue({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: GradeScaleValueProps): GradeScaleValue {
    return new GradeScaleValue(props);
  }

  get id(): Id { return this.props.id; }
  get scaleId(): Id { return this.props.scaleId; }
  get code(): string { return this.props.code; }
  get label(): string { return this.props.label; }
  get numericValue(): number | undefined { return this.props.numericValue; }
  get isApproved(): boolean { return this.props.isApproved; }
  get sortOrder(): number { return this.props.sortOrder; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}

export interface GradeScaleProps {
  id: Id;
  name: string;
  level: EducationalLevel;
  modality: EducationalModality;
  minValue?: number;
  maxValue?: number;
  isConceptual: boolean;
  active?: boolean;
  deletedAt?: Date;
  values?: GradeScaleValue[];
}

export class GradeScale {
  private constructor(private props: GradeScaleProps) {}

  static create(props: Omit<GradeScaleProps, 'id' | 'active' | 'deletedAt'>): GradeScale {
    return new GradeScale({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: GradeScaleProps): GradeScale {
    return new GradeScale(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): EducationalLevel { return this.props.level; }
  get modality(): EducationalModality { return this.props.modality; }
  get levelCode(): EducationalLevelCode { return this.props.level.code; }
  get modalityCode(): EducationalModalityCode { return this.props.modality.code; }
  get minValue(): number | undefined { return this.props.minValue; }
  get maxValue(): number | undefined { return this.props.maxValue; }
  get isConceptual(): boolean { return this.props.isConceptual; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get values(): GradeScaleValue[] | undefined { return this.props.values; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
