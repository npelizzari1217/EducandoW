import { Injectable } from '@nestjs/common';
import {
  ok, Result,
  StudentObservation, Id,
  StudentObservationRepository,
  getHighestRoleRank,
} from '@educandow/domain';
import { filterCycleObservations } from './observation-cycle-filter';

export interface ListByCycleInput {
  cycleId: string; // AcademicCycle uuid
  callerRoles: string[];
}

@Injectable()
export class ListObservationsByCycleUseCase {
  constructor(
    private readonly observationRepo: StudentObservationRepository,
  ) {}

  async execute(input: ListByCycleInput): Promise<Result<StudentObservation[], Error>> {
    const callerRank = getHighestRoleRank(input.callerRoles);

    // Fetch observations scoped to this AcademicCycle (no enrollment join — ADR-3)
    const observations = await this.observationRepo.findByAcademicCycleId(
      Id.reconstruct(input.cycleId),
    );

    // Apply academicCycleId equality filter + rank visibility
    return ok(filterCycleObservations(observations, input.cycleId, callerRank));
  }
}
