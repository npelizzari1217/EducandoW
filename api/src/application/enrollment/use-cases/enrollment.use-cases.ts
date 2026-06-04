import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, EnrollmentRepository, Enrollment, Id, Level, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';

export interface CreateEnrollmentInput {
  studentId: string;
  institutionId: string;
  level: string;
  modality?: string;
  academicYear: string;
  grade?: string;
  division?: string;
}

function buildLevel(level: string, modality?: string): Level {
  const parsed = Level.create(level);
  if (parsed.isOk()) return parsed.unwrap();
  const numeric = parseInt(level, 10);
  if (isNaN(numeric)) {
    throw new ValidationError(`Invalid level: "${level}". Cannot parse as a valid level code.`);
  }
  return Level.fromParts(
    numeric as EducationalLevelCode,
    (modality && parseInt(modality, 10) >= 0) ? parseInt(modality, 10) as EducationalModalityCode : EducationalModalityCode.COMUN,
  );
}

@Injectable()
export class CreateEnrollmentUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(input: CreateEnrollmentInput): Promise<Result<Enrollment, ValidationError>> {
    const lvl = buildLevel(input.level, input.modality);

    // Check if student already has an active enrollment in this level/year
    const existing = await this.repo.findActive(input.studentId);
    if (existing && existing.level.toString() === lvl.toString() && existing.academicYear === input.academicYear) {
      return err(new ValidationError('El estudiante ya tiene una inscripción activa en ese nivel para este año'));
    }

    const enrollment = Enrollment.create({
      studentId: Id.reconstruct(input.studentId),
      institutionId: Id.reconstruct(input.institutionId),
      level: lvl,
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

export type EnrollmentFlag = 'printable' | 'promoted';

@Injectable()
export class ToggleEnrollmentFlagUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(enrollmentId: string, flag: EnrollmentFlag): Promise<Result<Enrollment, NotFoundError>> {
    const enrollment = await this.repo.findById(enrollmentId);
    if (!enrollment) {
      return err(new NotFoundError('Enrollment', enrollmentId));
    }

    if (flag === 'printable') {
      enrollment.setPrintable(!enrollment.printable);
    } else {
      enrollment.setPromoted(!enrollment.promoted);
    }

    await this.repo.save(enrollment);
    return ok(enrollment);
  }
}

export interface BulkToggleEnrollmentFlagsInput {
  cycleId: string;
  flag: EnrollmentFlag;
  value: boolean;
}

@Injectable()
export class BulkToggleEnrollmentFlagsUseCase {
  constructor(private readonly repo: EnrollmentRepository) {}

  async execute(input: BulkToggleEnrollmentFlagsInput): Promise<number> {
    const enrollments = await this.repo.findByCycleId(input.cycleId);

    for (const enrollment of enrollments) {
      if (input.flag === 'printable') {
        enrollment.setPrintable(input.value);
      } else {
        enrollment.setPromoted(input.value);
      }
      await this.repo.save(enrollment);
    }

    return enrollments.length;
  }
}
