import { Id } from '../../shared/value-objects/id';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';
import type { SubjectFinalGradeType } from '../value-objects/subject-final-grade-type';
import type { SubjectFinalGradeCondicion } from '../value-objects/subject-final-grade-condicion';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreateSubjectFinalGradeInput {
  studentId:     string;
  courseCycleId: string;
  subjectId:     string;
  type:          SubjectFinalGradeType;
}

export interface ReconstructSubjectFinalGradeProps {
  id:                string;
  studentId:         string;
  courseCycleId:     string;
  subjectId:         string;
  type:              SubjectFinalGradeType;
  gradeScaleValueId: string | null;
  gradeCode:         string | null;
  internalStatus:    GradeInternalStatusValue | null;
  passed:            boolean | null;
  /** Nullable condicion — optional for backward-compat with pre-PR3 callers (defaults to null). */
  condicion?:        SubjectFinalGradeCondicion | null;
}

interface SubjectFinalGradeProps {
  id:                string;
  studentId:         string;
  courseCycleId:     string;
  subjectId:         string;
  type:              SubjectFinalGradeType;
  gradeScaleValueId: string | null;
  gradeCode:         string | null;
  internalStatus:    GradeInternalStatusValue | null;
  passed:            boolean | null;
  condicion:         SubjectFinalGradeCondicion | null;
}

// ─── Assign grade input ───────────────────────────────────────────────────────

export interface AssignSubjectFinalGradeInput {
  gradeScaleValueId: string;
  gradeCode:         string;
  internalStatus:    GradeInternalStatusValue;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * One row per (studentId, courseCycleId, subjectId, type) where type ∈ SubjectFinalGradeType.
 * Mirrors SubjectPeriodGrade pattern. Conditional lifecycle (Diciembre/Marzo/Definitiva)
 * is enforced in the use case, not here (AD-7).
 *
 * `condicion` carries the year-end verdict for Secundario (REGULAR | PREVIA | LIBRE).
 * Nullable — Primario rows carry null without error (COND-R4, COND-S8).
 * Cross-field validation (LIBRE+passed=true, PREVIA+passed=true) is enforced in
 * UpsertSubjectFinalGrades (D1), never here.
 */
export class SubjectFinalGrade {
  private constructor(private readonly props: SubjectFinalGradeProps) {}

  // ── Factories ──────────────────────────────────────────────────────────────

  /**
   * Lazy-creates an ungraded row. All grade fields null, passed null, condicion null.
   */
  static create(input: CreateSubjectFinalGradeInput): SubjectFinalGrade {
    return new SubjectFinalGrade({
      id:                Id.create().get(),
      studentId:         input.studentId,
      courseCycleId:     input.courseCycleId,
      subjectId:         input.subjectId,
      type:              input.type,
      gradeScaleValueId: null,
      gradeCode:         null,
      internalStatus:    null,
      passed:            null,
      condicion:         null,
    });
  }

  static reconstruct(props: ReconstructSubjectFinalGradeProps): SubjectFinalGrade {
    return new SubjectFinalGrade({
      ...props,
      condicion: props.condicion ?? null,
    });
  }

  // ── Behavior ──────────────────────────────────────────────────────────────

  /**
   * Assigns grade fields. gradeCode must be non-empty.
   */
  assignGrade(input: AssignSubjectFinalGradeInput): Result<void, ValidationError> {
    if (!input.gradeCode || !input.gradeCode.trim()) {
      return err(new ValidationError('gradeCode must not be empty when assigning a grade'));
    }
    this.props.gradeScaleValueId = input.gradeScaleValueId;
    this.props.gradeCode         = input.gradeCode;
    this.props.internalStatus    = input.internalStatus;
    return ok(undefined);
  }

  /**
   * Sets the teacher-supplied promotion verdict for this final instance.
   * No server-side formula — purely manual (SFG-R4).
   */
  setPassed(passed: boolean): Result<void, never> {
    this.props.passed = passed;
    return ok(undefined);
  }

  /**
   * Sets the year-end condicion for this final grade (Secundario: REGULAR | PREVIA | LIBRE).
   * undefined → no-op (leaves current condicion unchanged — COND-R2 / COND-S5).
   * No cross-field validation here — LIBRE+passed and PREVIA+passed are enforced in the
   * use case (D1).
   */
  setCondicion(condicion: SubjectFinalGradeCondicion | undefined): Result<void, never> {
    if (condicion !== undefined) {
      this.props.condicion = condicion;
    }
    return ok(undefined);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get id():                string                              { return this.props.id; }
  get studentId():         string                              { return this.props.studentId; }
  get courseCycleId():     string                              { return this.props.courseCycleId; }
  get subjectId():         string                              { return this.props.subjectId; }
  get type():              SubjectFinalGradeType               { return this.props.type; }
  get gradeScaleValueId(): string | null                       { return this.props.gradeScaleValueId; }
  get gradeCode():         string | null                       { return this.props.gradeCode; }
  get internalStatus():    GradeInternalStatusValue | null     { return this.props.internalStatus; }
  get passed():            boolean | null                      { return this.props.passed; }
  get condicion():         SubjectFinalGradeCondicion | null   { return this.props.condicion; }
}

