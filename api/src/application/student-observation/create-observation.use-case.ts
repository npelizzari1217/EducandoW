import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  ForbiddenError,
  StudentObservation, ObservationType, ObservationTypeValue, Id,
  StudentObservationRepository,
  getHighestRoleRank,
} from '@educandow/domain';

export interface CreateObservationInput {
  studentId: string;
  authorId: string;
  type: string;
  content: string;
  authorRoles: string[];
  /** AcademicCycle uuid. Required for PEDAGOGICAL; forbidden for PSYCHOPEDAGOGICAL. (ADR-3) */
  academicCycleId?: string;
}

@Injectable()
export class CreateObservationUseCase {
  constructor(private readonly repo: StudentObservationRepository) {}

  async execute(input: CreateObservationInput): Promise<Result<StudentObservation, Error>> {
    const authorRank = getHighestRoleRank(input.authorRoles);

    // Validate type
    const typeResult = ObservationType.create(input.type);
    if (typeResult.isErr()) return err(typeResult.unwrapErr());
    const type = typeResult.unwrap();

    // PSYCHOPEDAGOGICAL requires rank >= 50 (DIRECTOR+)
    if (type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL && authorRank < 50) {
      return err(new ForbiddenError('Only DIRECTOR+ roles can create PSYCHOPEDAGOGICAL observations'));
    }

    // Entity validates content length (1-2000 chars) and academicCycleId invariant, returns Result
    const observationResult = StudentObservation.create({
      studentId: Id.reconstruct(input.studentId),
      authorId: Id.reconstruct(input.authorId),
      type,
      content: input.content,
      academicCycleId: input.academicCycleId ? Id.reconstruct(input.academicCycleId) : undefined,
    });
    if (observationResult.isErr()) return err(observationResult.unwrapErr());
    const observation = observationResult.unwrap();

    await this.repo.save(observation);
    return ok(observation);
  }
}
