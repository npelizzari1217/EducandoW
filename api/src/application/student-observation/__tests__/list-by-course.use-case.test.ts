import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListObservationsByCourseUseCase } from '../list-by-course.use-case';
import type {
  StudentObservationRepository,
  CourseCycleRepository,
} from '@educandow/domain';
import { StudentObservation, ObservationType, ObservationTypeValue, Id } from '@educandow/domain';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeObs(
  type: ObservationTypeValue,
  studentId: Id,
  academicCycleId?: Id,
): StudentObservation {
  return StudentObservation.reconstruct({
    id: Id.create(),
    studentId,
    authorId: Id.create(),
    type: ObservationType.reconstruct(type),
    content: 'Test content',
    academicCycleId,
    createdAt: new Date(),
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ListObservationsByCourseUseCase — resolve cc.cycleId → filter by academicCycleId (ADR-3)', () => {
  let useCase: ListObservationsByCourseUseCase;
  let observationRepo: StudentObservationRepository;
  let courseCycleRepo: CourseCycleRepository;

  const academicCycleId = 'academic-cycle-uuid';
  const otherCycleId = 'other-cycle-uuid';
  const courseCycleUuid = 'course-cycle-uuid';

  const studentId1 = Id.reconstruct('student-1');
  const studentId2 = Id.reconstruct('student-2');

  // CourseCycle mock: cycleId is the AcademicCycle uuid
  const mockCourseCycle = { cycleId: academicCycleId, uuid: courseCycleUuid };

  beforeEach(() => {
    observationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByStudentIds: vi.fn().mockResolvedValue([]),
      findByAcademicCycleId: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    } as unknown as StudentObservationRepository;

    courseCycleRepo = {
      findByUuid: vi.fn().mockResolvedValue(mockCourseCycle),
    } as unknown as CourseCycleRepository;

    // No enrollmentRepo — constructor takes observationRepo + courseCycleRepo only (ADR-3)
    useCase = new ListObservationsByCourseUseCase(observationRepo, courseCycleRepo);
  });

  // ── Core: resolves cycleId from CourseCycle ───────────────────────────────

  it('calls findByUuid with the courseCycle uuid to resolve academicCycleId', async () => {
    await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(courseCycleRepo.findByUuid).toHaveBeenCalledWith(courseCycleUuid);
  });

  it('calls findByAcademicCycleId with the resolved academicCycleId (cc.cycleId)', async () => {
    await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(observationRepo.findByAcademicCycleId).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
    );
    const callArg = (observationRepo.findByAcademicCycleId as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.get()).toBe(academicCycleId);
  });

  it('returns NotFoundError when CourseCycle does not exist', async () => {
    vi.mocked(courseCycleRepo.findByUuid).mockResolvedValue(null);

    const result = await useCase.execute({ cycleId: 'nonexistent-uuid', callerRoles: ['DIRECTOR'] });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('nonexistent-uuid');
  });

  // ── PEDAGOGICAL: included only if academicCycleId matches resolved cc.cycleId ─

  it('excludes PEDAGOGICAL observation tied to a different academicCycleId', async () => {
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(otherCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([pedagogicalOtherCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  it('includes PEDAGOGICAL observation with matching academicCycleId', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(academicCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── PSYCHOPEDAGOGICAL: always included ───────────────────────────────────

  it('includes EOE (PSYCHOPEDAGOGICAL) regardless of academicCycleId', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([eoeObs]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  it('mixes correctly: includes this-cycle PEDAGOGICAL and EOE, excludes other-cycle PEDAGOGICAL', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(academicCycleId),
    );
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId2,
      Id.reconstruct(otherCycleId),
    );
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);

    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([
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

  // ── Rank filter: EOE hidden from non-DIRECTOR ────────────────────────────

  it('hides EOE from callers below DIRECTOR even in this course cycle', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(academicCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([eoeObs, pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: courseCycleUuid, callerRoles: ['TEACHER'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });
});
