import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListObservationsByCycleUseCase } from '../list-by-cycle.use-case';
import type {
  StudentObservationRepository,
  EnrollmentRepository,
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

describe('ListObservationsByCycleUseCase — direct academic-cycle scoping', () => {
  let useCase: ListObservationsByCycleUseCase;
  let observationRepo: StudentObservationRepository;
  let enrollmentRepo: EnrollmentRepository;

  const academicCycleId = 'academic-cycle-uuid';

  const studentId1 = Id.reconstruct('student-1');
  const studentId2 = Id.reconstruct('student-2');

  const enrollment1Id = 'enrollment-1';
  const enrollment2Id = 'enrollment-2';
  const otherEnrollmentId = 'enrollment-other-cycle';

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
    enrollmentRepo = {
      findByCycleId: vi.fn().mockResolvedValue(mockEnrollments),
    } as unknown as EnrollmentRepository;

    useCase = new ListObservationsByCycleUseCase(observationRepo, enrollmentRepo);
  });

  // ── Core: uses AcademicCycle uuid directly (no CourseCycle lookup) ────────

  it('calls findByCycleId with the provided academicCycleId directly', async () => {
    await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(enrollmentRepo.findByCycleId).toHaveBeenCalledWith(academicCycleId);
  });

  // ── PEDAGOGICAL: only observations from this cycle's enrollments ──────────

  it('includes PEDAGOGICAL observation tied to this cycle enrollment', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(enrollment1Id),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('excludes PEDAGOGICAL observation tied to a different cycle enrollment', async () => {
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(otherEnrollmentId),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([pedagogicalOtherCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  it('excludes legacy PEDAGOGICAL with null enrollmentId', async () => {
    const legacyPedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      undefined, // no enrollmentId — legacy record
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([legacyPedagogical]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  it('includes EOE (PSYCHOPEDAGOGICAL) observation regardless of enrollment', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([eoeObs]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  it('mixes correctly: includes this-cycle PEDAGOGICAL and EOE, excludes other-cycle and null-enrollment PEDAGOGICAL', async () => {
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
    const legacyPedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      undefined,
    );
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);

    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([
      pedagogicalThisCycle,
      pedagogicalOtherCycle,
      legacyPedagogical,
      eoeObs,
    ]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(2);
    expect(obs.some((o) => o.type.value === ObservationTypeValue.PEDAGOGICAL)).toBe(true);
    expect(obs.some((o) => o.type.value === ObservationTypeValue.PSYCHOPEDAGOGICAL)).toBe(true);
  });

  // ── Rank filter: EOE hidden from callers below DIRECTOR (rank < 50) ───────

  it('hides EOE from callers below DIRECTOR (rank < 50)', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(enrollment1Id),
    );
    vi.mocked(observationRepo.findByStudentIds).mockResolvedValue([eoeObs, pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['TEACHER'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── Edge: no enrollments → empty result ───────────────────────────────────

  it('returns empty array when no enrollments exist for the cycle', async () => {
    vi.mocked(enrollmentRepo.findByCycleId).mockResolvedValue([]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
    expect(observationRepo.findByStudentIds).not.toHaveBeenCalled();
  });
});
