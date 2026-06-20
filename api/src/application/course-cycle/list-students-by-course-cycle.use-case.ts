import { Injectable } from '@nestjs/common';
import type { AlumnosXCursoXCicloRepository, AlumnoCursoCicloEnriched } from '@educandow/domain';

/**
 * ListStudentsByCourseCycleUseCase — T-10 (SDD-1).
 *
 * Returns all students assigned to a CourseCycle, each enriched with
 * the student's display name (resolved from Student.firstName + lastName).
 *
 * Returns an empty list (not an error) when no students are assigned.
 * Throws (via TenantContext) when no tenant client is available.
 */
@Injectable()
export class ListStudentsByCourseCycleUseCase {
  constructor(private readonly repo: AlumnosXCursoXCicloRepository) {}

  async execute(courseCycleId: string): Promise<AlumnoCursoCicloEnriched[]> {
    return this.repo.findByCourseCycleEnriched(courseCycleId);
  }
}
