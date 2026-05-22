import { Id } from '../../shared/value-objects/id';

export type GradeStatus = 'APROBADO' | 'PREVIA' | 'LIBRE' | 'PROMOCION';

export interface GradeProps {
  id: Id;
  studentId: string;
  subjectId: string;
  courseSectionId: string;
  period: string;
  numericValue?: number;
  qualitativeValue?: string;
  status?: GradeStatus;
  evaluatedAt: Date;
}

export class Grade {
  private constructor(private props: GradeProps) {}

  static create(props: Omit<GradeProps, 'id' | 'evaluatedAt'>): Grade {
    return new Grade({ ...props, id: Id.create(), evaluatedAt: new Date() });
  }

  static reconstruct(props: GradeProps): Grade {
    return new Grade(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get subjectId(): string { return this.props.subjectId; }
  get courseSectionId(): string { return this.props.courseSectionId; }
  get period(): string { return this.props.period; }
  get numericValue(): number | undefined { return this.props.numericValue; }
  get qualitativeValue(): string | undefined { return this.props.qualitativeValue; }
  get status(): GradeStatus | undefined { return this.props.status; }
  get evaluatedAt(): Date { return this.props.evaluatedAt; }
}
