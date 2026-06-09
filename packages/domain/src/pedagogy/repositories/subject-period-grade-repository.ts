import type { SubjectPeriodGrade } from '../entities/subject-period-grade';

export interface SubjectPeriodGradeRepository {
  /**
   * Returns all SubjectPeriodGrade rows for a given (courseCycleId, subjectId).
   * Includes all students and all periods.
   * Tenant scoping is via TenantContext, not an explicit institutionId parameter.
   */
  findByCourseCycleAndSubject(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectPeriodGrade[]>;

  /**
   * Returns all SubjectPeriodGrade rows for a given (studentId, courseCycleId),
   * across all subjects and periods.
   * Tenant scoping is via TenantContext.
   */
  findByStudentAndCourseCycle(
    studentId: string,
    courseCycleId: string,
  ): Promise<SubjectPeriodGrade[]>;

  /**
   * Batch upserts rows keyed on (studentId, courseCycleId, subjectId, periodOrdinal).
   * Used by UpsertSubjectPeriodGrades for both grade and flag writes.
   * Tenant scoping is via TenantContext.
   */
  saveMany(
    grades: SubjectPeriodGrade[],
  ): Promise<void>;
}
