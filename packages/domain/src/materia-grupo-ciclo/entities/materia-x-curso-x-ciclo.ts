import { Id } from '../../shared/value-objects/id';

/**
 * MateriaXCursoXCiclo — represents one subject from the study plan
 * materialized into a specific CursoXCiclo (Fase 3, MGC-R1).
 *
 * Created when a user explicitly "Genera" a CourseCycle.
 * Two CourseCycles from the same plan produce INDEPENDENT sets of these rows (MGC-S3).
 *
 * studyPlanSubjectId is a soft provenance link (not a FK) to the source
 * StudyPlanSubject — kept so plan edits don't cascade into already-materialized subjects.
 */

export interface MateriaXCursoXCicloProps {
  id: string;
  /** Reference to CourseCycle.uuid in the tenant DB. */
  courseCycleId: string;
  /** Reference to Subject.id in the tenant DB. */
  subjectId: string;
  /** Soft provenance link to StudyPlanSubject (no FK — plan edits must not cascade). */
  studyPlanSubjectId?: string;
  /** Whether this subject is optional (optativa) for auto-cascade enrollment. Defaults false. MGC-R7. */
  esOptativa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMateriaXCursoXCicloInput {
  courseCycleId: string;
  subjectId: string;
  studyPlanSubjectId?: string;
  /** Optional; omitting defaults to false (obligatoria). MGC-R7. */
  esOptativa?: boolean;
}

export class MateriaXCursoXCiclo {
  private constructor(private readonly props: MateriaXCursoXCicloProps) {}

  static create(input: CreateMateriaXCursoXCicloInput): MateriaXCursoXCiclo {
    if (!input.courseCycleId) {
      throw new Error('MateriaXCursoXCiclo: courseCycleId is required');
    }
    if (!input.subjectId) {
      throw new Error('MateriaXCursoXCiclo: subjectId is required');
    }
    const now = new Date();
    return new MateriaXCursoXCiclo({
      id: Id.create().get(),
      courseCycleId: input.courseCycleId,
      subjectId: input.subjectId,
      studyPlanSubjectId: input.studyPlanSubjectId,
      esOptativa: input.esOptativa ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: MateriaXCursoXCicloProps): MateriaXCursoXCiclo {
    return new MateriaXCursoXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get subjectId(): string { return this.props.subjectId; }
  get studyPlanSubjectId(): string | undefined { return this.props.studyPlanSubjectId; }
  /** Whether this subject is optional for cascade enrollment. MGC-R7. */
  get esOptativa(): boolean { return this.props.esOptativa; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
