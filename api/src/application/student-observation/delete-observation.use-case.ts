import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  NotFoundError, ForbiddenError,
  Id,
  StudentObservationRepository,
  getHighestRoleRank,
} from '@educandow/domain';

export interface DeleteObservationInput {
  observationId: string;
  callerId: string;
  callerRoles: string[];
}

@Injectable()
export class DeleteObservationUseCase {
  constructor(private readonly repo: StudentObservationRepository) {}

  async execute(input: DeleteObservationInput): Promise<Result<void, Error>> {
    const observation = await this.repo.findById(Id.reconstruct(input.observationId));
    if (!observation) {
      return err(new NotFoundError('StudentObservation', input.observationId));
    }

    const callerRank = getHighestRoleRank(input.callerRoles);
    const isAuthor = observation.isAuthoredBy(Id.reconstruct(input.callerId));
    const isAdmin = callerRank >= 60;

    if (!isAuthor && !isAdmin) {
      return err(new ForbiddenError('Only the author or ADMIN+ roles can delete observations'));
    }

    await this.repo.delete(Id.reconstruct(input.observationId));
    return ok(undefined);
  }
}
