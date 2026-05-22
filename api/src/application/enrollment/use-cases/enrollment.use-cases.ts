import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, EnrollmentRepository, Enrollment, EnrollmentStatus, Id, Level, LevelType } from '@educandow/domain';

export interface CreateEnrollmentInput {
  studentId: string;
  institutionId: string;
  level: string;
  academicYear: string;
  grade?: string;
  division?: string;
}

@Injectable()
export class CreateEnrollmentUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(input: CreateEnrollmentInput): Promise<Result<Enrollment, ValidationError>> {
    // Check if student already has an active enrollment in this level/year
    const existing = await this.repo.findActive(input.studentId);
    if (existing && existing.level.toString() === input.level && existing.academicYear === input.academicYear) {
      return err(new ValidationError('El estudiante ya tiene una inscripción activa en ese nivel para este año'));
    }

    const enrollment = Enrollment.create({
      studentId: Id.reconstruct(input.studentId),
      institutionId: Id.reconstruct(input.institutionId),
      level: Level.reconstruct(input.level as LevelType),
      academicYear: input.academicYear,
      grade: input.grade,
      division: input.division,
    });

    await this.repo.save(enrollment);
    return ok(enrollment);
  }
}

@Injectable()
export class ListEnrollmentsUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async executeByStudent(studentId: string): Promise<Enrollment[]> {
    return this.repo.findByStudent(studentId);
  }

  async executeByInstitution(institutionId: string): Promise<Enrollment[]> {
    return this.repo.findByInstitution(institutionId);
  }
}

@Injectable()
export class GetEnrollmentUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(id: string): Promise<Enrollment | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteEnrollmentUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
