import { Id } from '../../shared/value-objects/id';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';
import { Level, LevelType } from '../../institution/value-objects/level';

export interface SubjectProps {
  id: Id;
  name: string;
  level: Level;
  institutionId: string;
  active?: boolean;
  deletedAt?: Date;
}

export class Subject {
  private constructor(private props: SubjectProps) {}

  static create(props: Omit<SubjectProps, 'id' | 'active' | 'deletedAt'>): Subject {
    return new Subject({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: SubjectProps): Subject {
    return new Subject(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): Level { return this.props.level; }
  /** Código del nivel base (1–4, 9). */
  get levelCode(): EducationalLevelCode { return this.props.level.levelCode; }
  /** Código de la modalidad (0–2, 9). */
  get modalityCode(): EducationalModalityCode { return this.props.level.modalityCode; }
  /** Código compuesto (legado). */
  get compositeLevelCode(): LevelType { return this.props.level.get(); }
  get institutionId(): string { return this.props.institutionId; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
