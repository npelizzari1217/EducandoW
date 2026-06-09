import { Id } from '../../shared/value-objects/id';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import type { GradeInternalStatusValue } from '../../grading/value-objects/grade-internal-status';
import type { SubjectFinalGradeType } from '../value-objects/subject-final-grade-type';

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
 */
export class SubjectFinalGrade {
  private constructor(private readonly props: SubjectFinalGradeProps) {}

  // ── Factories ──────────────────────────────────────────────────────────────

  /**
   * Lazy-creates an ungraded row. All grade fields null, passed null.
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
    });
  }

  static reconstruct(props: ReconstructSubjectFinalGradeProps): SubjectFinalGrade {
    return new SubjectFinalGrade({ ...props });
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

  // ── Getters ────────────────────────────────────────────────────────────────

  get id():                string                       { return this.props.id; }
  get studentId():         string                       { return this.props.studentId; }
  get courseCycleId():     string                       { return this.props.courseCycleId; }
  get subjectId():         string                       { return this.props.subjectId; }
  get type():              SubjectFinalGradeType        { return this.props.type; }
  get gradeScaleValueId(): string | null                { return this.props.gradeScaleValueId; }
  get gradeCode():         string | null                { return this.props.gradeCode; }
  get internalStatus():    GradeInternalStatusValue | null { return this.props.internalStatus; }
  get passed():            boolean | null               { return this.props.passed; }
}
