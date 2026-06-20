import { Injectable } from '@nestjs/common';
import type { CourseCycleRepository, AlumnosXCursoXCicloRepository } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * RemoveStudentFromCourseCycleUseCase — T-12 (SDD-1).
 *
 * Removes a student from a CourseCycle using the bridge-row id (ADR #1243).
 * Validates that both the CourseCycle and the enrollment row exist and belong
 * to the same cycle (IDOR prevention). Throws NotFoundError in both cases.
 */
@Injectable()
export class RemoveStudentFromCourseCycleUseCase {
  constructor(
    private readonly ccRepo: CourseCycleRepository,
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
  ) {}

  async execute(input: { courseCycleId: string; id: string }): Promise<void> {
    // Validate CourseCycle exists
    const cc = await this.ccRepo.findByUuid(input.courseCycleId);
    if (!cc) {
      throw new NotFoundError('CourseCycle', input.courseCycleId);
    }

    // Validate enrollment exists and belongs to this CourseCycle (IDOR prevention)
    const enrollment = await this.alumnosRepo.findById(input.id);
    if (!enrollment || enrollment.courseCycleId !== input.courseCycleId) {
      throw new NotFoundError('AlumnosXCursoXCiclo', input.id);
    }

    await this.alumnosRepo.remove(input.courseCycleId, input.id);
  }
}
