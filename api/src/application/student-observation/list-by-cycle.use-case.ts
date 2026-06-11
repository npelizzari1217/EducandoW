import { Injectable } from '@nestjs/common';
import {
  ok, Result,
  StudentObservation, Id,
  StudentObservationRepository,
  EnrollmentRepository,
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
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  async execute(input: ListByCycleInput): Promise<Result<StudentObservation[], Error>> {
    const callerRank = getHighestRoleRank(input.callerRoles);

    // 1. Find all enrollments for this academic cycle directly (no CourseCycle lookup)
    const enrollments = await this.enrollmentRepo.findByCycleId(input.cycleId);
    const studentIds = enrollments.map((e) => Id.reconstruct(e.studentId.get()));

    if (studentIds.length === 0) {
      return ok([]);
    }

    // 2. Fetch observations for all these students
    const observations = await this.observationRepo.findByStudentIds(studentIds);

    // 3. Apply cycle-scope + rank filter via shared helper
    const cycleEnrollmentIds = new Set(enrollments.map((e) => e.id.get()));
    return ok(filterCycleObservations(observations, cycleEnrollmentIds, callerRank));
  }
}
