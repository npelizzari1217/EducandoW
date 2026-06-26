import { Injectable } from '@nestjs/common';
import type { CourseCycleRepository, AlumnosXCursoXCicloRepository, StudentRepository } from '@educandow/domain';
import { NotFoundError, StudentHasPaseError } from '@educandow/domain';

/**
 * RemoveStudentFromCourseCycleUseCase — T-12 (SDD-1).
 *
 * Removes a student from a CourseCycle using the bridge-row id (ADR #1243).
 * Validates that both the CourseCycle and the enrollment row exist and belong
 * to the same cycle (IDOR prevention). Throws NotFoundError in both cases.
 *
 * pase-alumno-egreso (PR2, T-2.5): backend guard — rejects remove when the
 * student has an active pase (StudentHasPaseError → 409). Defense-in-depth:
 * the UI also disables the "Quitar" button for students with pase.
 */
@Injectable()
export class RemoveStudentFromCourseCycleUseCase {
  constructor(
    private readonly ccRepo: CourseCycleRepository,
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
    private readonly studentRepo: StudentRepository,
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

    // Guard: prevent removing a student with an active pase (ADR-4, pase-alumno-egreso)
    const student = await this.studentRepo.findById(enrollment.studentId);
    if (student?.tienePase) throw new StudentHasPaseError();

    await this.alumnosRepo.remove(input.courseCycleId, input.id);
  }
}
