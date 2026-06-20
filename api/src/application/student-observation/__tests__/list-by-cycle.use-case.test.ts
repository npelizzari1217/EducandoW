import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListObservationsByCycleUseCase } from '../list-by-cycle.use-case';
import type { StudentObservationRepository } from '@educandow/domain';
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

describe('ListObservationsByCycleUseCase — academicCycleId equality filter (ADR-3)', () => {
  let useCase: ListObservationsByCycleUseCase;
  let observationRepo: StudentObservationRepository;

  const academicCycleId = 'academic-cycle-uuid';
  const otherCycleId = 'other-cycle-uuid';

  const studentId1 = Id.reconstruct('student-1');
  const studentId2 = Id.reconstruct('student-2');

  beforeEach(() => {
    observationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByStudentIds: vi.fn().mockResolvedValue([]),
      findByAcademicCycleId: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    } as unknown as StudentObservationRepository;

    // No enrollmentRepo — constructor takes observationRepo only (ADR-3)
    useCase = new ListObservationsByCycleUseCase(observationRepo);
  });

  // ── Core: calls findByAcademicCycleId directly (no enrollment join) ───────

  it('calls findByAcademicCycleId with the provided academicCycleId', async () => {
    await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(observationRepo.findByAcademicCycleId).toHaveBeenCalledWith(
      expect.objectContaining({ get: expect.any(Function) }),
    );
    const callArg = (observationRepo.findByAcademicCycleId as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.get()).toBe(academicCycleId);
  });

  it('does NOT call findByCycleId on any enrollment repo (no enrollment dependency)', async () => {
    // Passing no enrollmentRepo to constructor confirms the use-case doesn't need it
    // Just verifying execute() completes without throwing due to undefined enrollmentRepo
    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });
    expect(result.isOk()).toBe(true);
  });

  // ── PEDAGOGICAL: included only if academicCycleId matches ────────────────

  it('includes PEDAGOGICAL observation with matching academicCycleId', async () => {
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(academicCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('excludes PEDAGOGICAL observation with different academicCycleId', async () => {
    const pedagogicalOtherCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(otherCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([pedagogicalOtherCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  it('excludes legacy PEDAGOGICAL with undefined academicCycleId', async () => {
    const legacyPedagogical = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      undefined,
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([legacyPedagogical]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });

  // ── PSYCHOPEDAGOGICAL: always included ───────────────────────────────────

  it('includes EOE (PSYCHOPEDAGOGICAL) regardless of academicCycleId', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([eoeObs]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].type.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  // ── Mixed set ─────────────────────────────────────────────────────────────

  it('mixed: includes this-cycle PEDAGOGICAL and EOE, excludes other-cycle PEDAGOGICAL', async () => {
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
    const legacyPedagogical = makeObs(ObservationTypeValue.PEDAGOGICAL, studentId1, undefined);
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);

    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([
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

  // ── Rank filter: EOE hidden from non-DIRECTOR ────────────────────────────

  it('hides EOE from callers below DIRECTOR (rank < 50)', async () => {
    const eoeObs = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL, studentId1, undefined);
    const pedagogicalThisCycle = makeObs(
      ObservationTypeValue.PEDAGOGICAL,
      studentId1,
      Id.reconstruct(academicCycleId),
    );
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([eoeObs, pedagogicalThisCycle]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['TEACHER'] });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── Edge: empty result ───────────────────────────────────────────────────

  it('returns empty array when findByAcademicCycleId returns empty', async () => {
    vi.mocked(observationRepo.findByAcademicCycleId).mockResolvedValue([]);

    const result = await useCase.execute({ cycleId: academicCycleId, callerRoles: ['DIRECTOR'] });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });
});
