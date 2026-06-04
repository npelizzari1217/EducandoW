import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  NotFoundError,
  StudentObservation, ObservationTypeValue, Id,
  StudentObservationRepository,
  EnrollmentRepository,
  CourseCycleRepository,
  getHighestRoleRank,
} from '@educandow/domain';

export interface ListByCourseInput {
  cycleId: string; // CourseCycle uuid
  callerRoles: string[];
}

@Injectable()
export class ListObservationsByCourseUseCase {
  constructor(
    private readonly observationRepo: StudentObservationRepository,
    private readonly courseCycleRepo: CourseCycleRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  async execute(input: ListByCourseInput): Promise<Result<StudentObservation[], Error>> {
    const callerRank = getHighestRoleRank(input.callerRoles);

    // 1. Find the CourseCycle by its uuid
    const courseCycle = await this.courseCycleRepo.findByUuid(input.cycleId);
    if (!courseCycle) {
      return err(new NotFoundError('CourseCycle', input.cycleId));
    }

    // 2. Find all enrollments for this academic cycle
    const enrollments = await this.enrollmentRepo.findByCycleId(courseCycle.cycleId);
    const studentIds = enrollments.map((e) => Id.reconstruct(e.studentId.get()));

    if (studentIds.length === 0) {
      return ok([]);
    }

    // 3. Fetch observations for all these students
    const observations = await this.observationRepo.findByStudentIds(studentIds);

    // 4. Filter PSYCHOPEDAGOGICAL for callers below DIRECTOR
    if (callerRank < 50) {
      return ok(observations.filter((o) => o.type.value !== ObservationTypeValue.PSYCHOPEDAGOGICAL));
    }

    return ok(observations);
  }
}
