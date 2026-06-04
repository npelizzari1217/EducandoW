import { Injectable } from '@nestjs/common';
import {
  ok, Result,
  StudentObservation, ObservationTypeValue, Id,
  StudentObservationRepository,
  getHighestRoleRank,
} from '@educandow/domain';

export interface ListByStudentInput {
  studentId: string;
  callerRoles: string[];
}

@Injectable()
export class ListObservationsByStudentUseCase {
  constructor(private readonly repo: StudentObservationRepository) {}

  async execute(input: ListByStudentInput): Promise<Result<StudentObservation[], Error>> {
    const callerRank = getHighestRoleRank(input.callerRoles);

    const observations = await this.repo.findByStudentId(Id.reconstruct(input.studentId));

    // Filter: PSYCHOPEDAGOGICAL hidden from roles below DIRECTOR (rank 50)
    if (callerRank < 50) {
      return ok(observations.filter((o) => o.type.value !== ObservationTypeValue.PSYCHOPEDAGOGICAL));
    }

    return ok(observations);
  }
}
