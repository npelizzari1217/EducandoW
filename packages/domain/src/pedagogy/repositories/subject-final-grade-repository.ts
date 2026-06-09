import type { SubjectFinalGrade } from '../entities/subject-final-grade';

export interface SubjectFinalGradeRepository {
  /**
   * Returns all SubjectFinalGrade rows for a given (courseCycleId, subjectId).
   * Includes all students and all types present (not necessarily all four).
   * Tenant scoping is via TenantContext, not an explicit institutionId parameter. (W2 convention)
   */
  findByCourseCycleAndSubject(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectFinalGrade[]>;

  /**
   * Returns all SubjectFinalGrade rows for a given (studentId, courseCycleId),
   * across all subjects and types.
   * Tenant scoping is via TenantContext.
   */
  findByStudentAndCourseCycle(
    studentId: string,
    courseCycleId: string,
  ): Promise<SubjectFinalGrade[]>;

  /**
   * Batch upserts rows keyed on (studentId, courseCycleId, subjectId, type).
   * Supports the conditional lifecycle: rows are created on-demand by callers.
   * Tenant scoping is via TenantContext.
   */
  saveMany(grades: SubjectFinalGrade[]): Promise<void>;
}
