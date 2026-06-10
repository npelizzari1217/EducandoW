import { Id } from '../../shared/value-objects/id';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { SubjectFinalGradeCondicion } from '../../pedagogy/value-objects/subject-final-grade-condicion';

// ─── MateriaPreviaStatus ────────────────────────────────────────────────────────

/**
 * Resolution state for a materia previa.
 *
 * PENDIENTE — the student still owes the subject.
 * APROBADA  — the student passed the exam and cleared the debt (has a resolvedGradeCode snapshot).
 * LIBRE     — the student took the exam as libre (debt outcome recorded).
 */
export enum MateriaPreviaStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA  = 'APROBADA',
  LIBRE     = 'LIBRE',
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface CreateMateriaPreviaInput {
  studentId:           string;
  subjectId:           string;
  /** The academic year the subject debt originates from (e.g. "2024"). */
  originAcademicYear:  string;
  /** Optional provenance link — the course cycle the student attended when the debt arose. */
  originCourseCycleId?: string;
  /**
   * How the debt arose. MUST be PREVIA or LIBRE.
   *
   * NOTE: REGULAR is a valid SubjectFinalGradeCondicion in other contexts (e.g. on
   * SubjectFinalGrade.condicion for regular Secundario students). It is NEVER valid here
   * because a "materia previa" by definition means the student did not regularize — a
   * REGULAR student has no academic debt to track.
   */
  condicion:           SubjectFinalGradeCondicion;
}

export interface ReconstructMateriaPreviaProps {
  id:                  string;
  studentId:           string;
  subjectId:           string;
  originAcademicYear:  string;
  originCourseCycleId?: string;
  condicion:           SubjectFinalGradeCondicion;
  status:              MateriaPreviaStatus;
  resolvedGradeCode?:  string;
  resolvedAt?:         Date;
  createdAt:           Date;
  updatedAt:           Date;
}

interface MateriaPreviaProps {
  id:                  string;
  studentId:           string;
  subjectId:           string;
  originAcademicYear:  string;
  originCourseCycleId?: string;
  condicion:           SubjectFinalGradeCondicion;
  status:              MateriaPreviaStatus;
  resolvedGradeCode?:  string;
  resolvedAt?:         Date;
  createdAt:           Date;
  updatedAt:           Date;
}

// ─── Entity ────────────────────────────────────────────────────────────────────

/**
 * Aggregate representing a Secundario student's academic debt for a specific subject
 * from a prior academic year (materia previa histórica).
 *
 * Unique key: (studentId, subjectId, originAcademicYear) — enforced in Prisma.
 *
 * Domain invariant: `condicion` MUST be PREVIA or LIBRE.
 * REGULAR is intentionally excluded — a REGULAR student has no carry-over debt.
 * This entity lives in the `secundario` bounded context (screaming architecture),
 * NOT in `pedagogy`, because previas are a Secundario-specific concept.
 */
export class MateriaPrevia {
  private constructor(private props: MateriaPreviaProps) {}

  // ── Factories ─────────────────────────────────────────────────────────────

  /**
   * Creates a new MateriaPrevia record with status PENDIENTE.
   * Enforces the domain invariant: condicion MUST be PREVIA or LIBRE.
   */
  static create(
    input: CreateMateriaPreviaInput,
  ): Result<MateriaPrevia, ValidationError> {
    // Domain invariant: REGULAR is not a valid condicion for a materia previa.
    if (input.condicion === SubjectFinalGradeCondicion.REGULAR) {
      return err(
        new ValidationError(
          'condicion REGULAR is invalid for a materia previa. ' +
          'Only PREVIA or LIBRE are valid condicion values for academic debt records. ' +
          'A REGULAR student has no carry-over subject debt.',
        ),
      );
    }

    if (!input.subjectId || input.subjectId.trim().length === 0) {
      return err(new ValidationError('subjectId is required for a materia previa'));
    }

    if (!input.originAcademicYear || input.originAcademicYear.trim().length === 0) {
      return err(new ValidationError('originAcademicYear is required for a materia previa'));
    }

    const now = new Date();
    return ok(
      new MateriaPrevia({
        id:                  Id.create().get(),
        studentId:           input.studentId,
        subjectId:           input.subjectId,
        originAcademicYear:  input.originAcademicYear,
        originCourseCycleId: input.originCourseCycleId,
        condicion:           input.condicion,
        status:              MateriaPreviaStatus.PENDIENTE,
        createdAt:           now,
        updatedAt:           now,
      }),
    );
  }

  /**
   * Reconstructs a MateriaPrevia from persistence without validation.
   * Caller (Prisma repo) is responsible for data integrity.
   */
  static reconstruct(props: ReconstructMateriaPreviaProps): MateriaPrevia {
    return new MateriaPrevia(props);
  }

  // ── Behavior ──────────────────────────────────────────────────────────────

  /**
   * Marks the previa as resolved (passed). Snapshots the grade code and timestamp.
   * gradeCode must be a non-empty string.
   */
  resolve(gradeCode: string): Result<void, ValidationError> {
    if (!gradeCode || !gradeCode.trim()) {
      return err(new ValidationError('gradeCode must not be empty when resolving a materia previa'));
    }
    this.props.status           = MateriaPreviaStatus.APROBADA;
    this.props.resolvedGradeCode = gradeCode;
    this.props.resolvedAt       = new Date();
    this.props.updatedAt        = new Date();
    return ok(undefined);
  }

  /**
   * Marks the previa as libre (student took the libre exam path).
   * Always succeeds — no domain validation needed for this transition.
   */
  markLibre(): Result<void, never> {
    this.props.status    = MateriaPreviaStatus.LIBRE;
    this.props.updatedAt = new Date();
    return ok(undefined);
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get id():                  string                      { return this.props.id; }
  get studentId():           string                      { return this.props.studentId; }
  get subjectId():           string                      { return this.props.subjectId; }
  get originAcademicYear():  string                      { return this.props.originAcademicYear; }
  get originCourseCycleId(): string | undefined          { return this.props.originCourseCycleId; }
  get condicion():           SubjectFinalGradeCondicion  { return this.props.condicion; }
  get status():              MateriaPreviaStatus         { return this.props.status; }
  get resolvedGradeCode():   string | undefined          { return this.props.resolvedGradeCode; }
  get resolvedAt():          Date | undefined            { return this.props.resolvedAt; }
  get createdAt():           Date                        { return this.props.createdAt; }
  get updatedAt():           Date                        { return this.props.updatedAt; }
}
