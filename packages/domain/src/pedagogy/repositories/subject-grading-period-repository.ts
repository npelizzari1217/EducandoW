import type { SubjectGradingPeriod } from '../entities/subject-grading-period';

export interface SubjectGradingPeriodRepository {
  /**
   * Returns all snapshotted period rows for a (courseCycleId, subjectId) pair.
   * Tenant scoping is via TenantContext, not an explicit institutionId parameter.
   */
  findByCourseCycleAndSubject(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectGradingPeriod[]>;

  /**
   * Idempotent snapshot: if no rows exist for (courseCycleId, subjectId),
   * copies them from GradingPeriodTemplate(level, modality).items ordered by sortOrder.
   * If rows already exist, this is a no-op. (AD-5)
   * Tenant scoping is via TenantContext.
   */
  ensureSnapshot(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectGradingPeriod[]>;

  /**
   * Persists a single snapshot row.
   * Tenant scoping is via TenantContext.
   */
  save(
    period: SubjectGradingPeriod,
  ): Promise<void>;
}
