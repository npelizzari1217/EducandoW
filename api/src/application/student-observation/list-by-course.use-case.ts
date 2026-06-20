import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  NotFoundError,
  StudentObservation, Id,
  StudentObservationRepository,
  CourseCycleRepository,
  getHighestRoleRank,
} from '@educandow/domain';
import { filterCycleObservations } from './observation-cycle-filter';

export interface ListByCourseInput {
  cycleId: string; // CourseCycle uuid
  callerRoles: string[];
}

@Injectable()
export class ListObservationsByCourseUseCase {
  constructor(
    private readonly observationRepo: StudentObservationRepository,
    private readonly courseCycleRepo: CourseCycleRepository,
  ) {}

  async execute(input: ListByCourseInput): Promise<Result<StudentObservation[], Error>> {
    const callerRank = getHighestRoleRank(input.callerRoles);

    // 1. Resolve AcademicCycle uuid via CourseCycle (ADR-3)
    const courseCycle = await this.courseCycleRepo.findByUuid(input.cycleId);
    if (!courseCycle) {
      return err(new NotFoundError('CourseCycle', input.cycleId));
    }

    // 2. Fetch observations scoped to the resolved AcademicCycle
    const observations = await this.observationRepo.findByAcademicCycleId(
      Id.reconstruct(courseCycle.cycleId),
    );

    // 3. Apply academicCycleId equality filter + rank visibility
    return ok(filterCycleObservations(observations, courseCycle.cycleId, callerRank));
  }
}
