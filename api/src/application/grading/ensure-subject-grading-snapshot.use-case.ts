/**
 * PR4-T2 [GREEN] — EnsureSubjectGradingSnapshotUseCase.
 * Idempotent: copies GradingPeriodTemplate items → SubjectGradingPeriod rows
 * for (courseCycle, subject) if absent. No-op when rows already exist (AD-5).
 * Specs: SPG-R2, AD-5
 */
import { Injectable } from '@nestjs/common';
import type { SubjectGradingPeriod, SubjectGradingPeriodRepository } from '@educandow/domain';

@Injectable()
export class EnsureSubjectGradingSnapshotUseCase {
  constructor(private readonly repo: SubjectGradingPeriodRepository) {}

  async execute(courseCycleId: string, subjectId: string): Promise<SubjectGradingPeriod[]> {
    return this.repo.ensureSnapshot(courseCycleId, subjectId);
  }
}
