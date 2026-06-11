import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListObservationsByCourseUseCase } from '../list-by-course.use-case';
import type {
  StudentObservationRepository,
  EnrollmentRepository,
  CourseCycleRepository,
} from '@educandow/domain';
import { StudentObservation, ObservationType, ObservationTypeValue, Id } from '@educandow/domain';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeObs(
  type: ObservationTypeValue,
  studentId: Id,
  enrollmentId?: Id,
): StudentObservation {
  return StudentObservation.reconstruct({
    id: Id.create(),
    studentId,
    authorId: Id.create(),
    type: ObservationType.reconstruct(type),
    content: 'Test content',
    enrollmentId,
    createdAt: new Date(),
  });
}

function makeEnrollment(id: string, studentId: string) {
  return {
    id: Id.reconstruct(id),
    studentId: Id.reconstruct(studentId),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ListObservationsByCourseUseCase — enrollment-cycle scoping', () => {
  let useCase: ListObservationsByCourseUseCase;
  let observationRepo: StudentObservationRepository;
  let courseCycleRepo: CourseCycleRepository;
  let enrollmentRepo: EnrollmentRepository;

  const cycleId = 'academic-cycle-uuid';
  const courseCycleUuid = 'course-cycle-uuid';

  const studentId1 = Id.reconstruct('student-1');
  const studentId2 = Id.reconstruct('student-2');

  const enrollment1Id = 'enrollment-1';
  const enrollment2Id = 'enrollment-2';
  const otherEnrollmentId = 'enrollment-other-cycle';

  const mockCourseCycle = { cycleId, uuid: courseCycleUuid };
  const mockEnrollments = [
    makeEnrollment(enrollment1Id, 'student-1'),
    makeEnrollment(enrollment2Id, 'student-2'),
  ];

  beforeEach(() => {
    observationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByStudentIds: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };
    courseCycleRepo = {
      findByUuid: vi.fn().mockResolvedValue(mockCourseCycle),
    } as unknown as CourseCycleRepository;
    enrollmentRepo = {
      findByCycleId: vi.fn().mockResolvedValue(mockEnrollments),
    } as unknown as EnrollmentRepository;

    useCase = new ListObservationsByCourseUseCase(
      observationRepo,
      courseCycleRepo,
      enrollmentRepo,
    );
  });

  // ── PEDAGOGICAL: only observations from this cycle's enrollments ──────────

  it('excludes PEDAGOGICAL observation tied to a different cycle enrollment', async () => {
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(otherEnrollmentId),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([pedagogicalOtherCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  it('includes PEDAGOGICAL observation tied to this cycle enrollment', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(enrollment1Id),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('includes EOE (PSYCHOPEDAGOGICAL) observation regardless of enrollment', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([eoeObs]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  it('mixes correctly: includes this-cycle PEDAGOGICAL and EOE, excludes other-cycle PEDAGOGICAL', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(enrollment1Id),
    );
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId2,
      Id.reconstruct(otherEnrollmentId),
    );
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);

    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([
      pedagogicalThisCycle,
      pedagogicalOtherCycle,
      eoeObs,
    ]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(2);
    expect(obs.some((o) => o.type.value === ObservationTypeValue.PEDAGOGICAL)).toBe(true);
    expect(obs.some((o) => o.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL)).toBe(true);
  });

  // ── EOE still hidden from callers below DIRECTOR (rank < 50) ─────────────

  it('hides EOE from callers below DIRECTOR even in this cycle', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(enrollment1Id),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([eoeObs, pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['TEACHER'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });
});
