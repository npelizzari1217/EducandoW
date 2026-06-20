import { Injectable } from '@nestjs/common';
import type {
  CourseCycleRepository,
  AlumnosXCursoXCicloRepository,
  AlumnosXCursoXCiclo,
  StudentRepository,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * AddStudentToCourseCycleUseCase — T-08 (SDD-1).
 *
 * Enrolls a student in a CourseCycle.
 * Both CourseCycle and Student MUST exist in the tenant DB.
 * Idempotent: if the pair already exists, the existing record is returned
 * without error and without creating a duplicate (@@unique via upsert).
 */
@Injectable()
export class AddStudentToCourseCycleUseCase {
  constructor(
    private readonly ccRepo: CourseCycleRepository,
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async execute(input: {
    courseCycleId: string;
    studentId: string;
  }): Promise<AlumnosXCursoXCiclo> {
    // Validate CourseCycle exists (checked first — consistent with spec S-07)
    const cc = await this.ccRepo.findByUuid(input.courseCycleId);
    if (!cc) {
      throw new NotFoundError('CourseCycle', input.courseCycleId);
    }

    // Validate Student exists (spec S-06)
    const student = await this.studentRepo.findById(input.studentId);
    if (!student) {
      throw new NotFoundError('Student', input.studentId);
    }

    // Add to universe — idempotent via @@unique([courseCycleId, studentId])
    return this.alumnosRepo.addStudent(input.courseCycleId, input.studentId);
  }
}
