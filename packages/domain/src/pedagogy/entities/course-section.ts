import { Id } from '../../shared/value-objects/id';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';
import { Level, LevelType } from '../../institution/value-objects/level';

export interface CourseSectionProps {
  id: Id;
  name: string;
  grade?: string;
  division?: string;
  level: Level;
  academicYear: string;
  institutionId: Id;
  active?: boolean;
  deletedAt?: Date;
}

export class CourseSection {
  private constructor(private props: CourseSectionProps) {}

  static create(props: Omit<CourseSectionProps, 'id' | 'active' | 'deletedAt'>): CourseSection {
    return new CourseSection({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: CourseSectionProps): CourseSection {
    return new CourseSection(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get grade(): string | undefined { return this.props.grade; }
  get division(): string | undefined { return this.props.division; }
  get level(): Level { return this.props.level; }
  /** Código del nivel base (1–4, 9). */
  get levelCode(): EducationalLevelCode { return this.props.level.levelCode; }
  /** Código de la modalidad (0–2, 9). */
  get modalityCode(): EducationalModalityCode { return this.props.level.modalityCode; }
  /** Código compuesto (legado). */
  get compositeLevelCode(): LevelType { return this.props.level.get(); }
  get academicYear(): string { return this.props.academicYear; }
  get institutionId(): Id { return this.props.institutionId; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
