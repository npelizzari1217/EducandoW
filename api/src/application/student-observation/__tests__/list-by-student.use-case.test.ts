import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListObservationsByStudentUseCase } from '../list-by-student.use-case';
import type { StudentObservationRepository } from '@educandow/domain';
import { StudentObservation, ObservationType, ObservationTypeValue, Id } from '@educandow/domain';

function makeObs(type: ObservationTypeValue): StudentObservation {
  return StudentObservation.reconstruct({
    id: Id.create(),
    studentId: Id.create(),
    authorId: Id.create(),
    type: ObservationType.reconstruct(type),
    content: 'Test content',
    createdAt: new Date(),
  });
}

describe('ListObservationsByStudentUseCase — role-based filtering', () => {
  let useCase: ListObservationsByStudentUseCase;
  let repo: StudentObservationRepository;

  const pedagogical = makeObs(ObservationTypeValue.PEDAGOGICAL);
  const psychopedagogical = makeObs(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  const bothObservations = [pedagogical, psychopedagogical];

  beforeEach(() => {
    repo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn().mockResolvedValue(bothObservations),
      findByStudentIds: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new ListObservationsByStudentUseCase(repo);
  });

  // ── Spec scenario: TEACHER (rank 20) — PSYCHOPEDAGOGICAL hidden ─────────────

  it('hides PSYCHOPEDAGOGICAL observations from TEACHER role (rank 20)', async () => {
    // GIVEN a TEACHER user (rank 20)
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['TEACHER'],
    });

    // THEN only PEDAGOGICAL observations are returned
    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── Spec scenario: PRECEPTOR (rank 30) — PSYCHOPEDAGOGICAL still hidden ─────

  it('hides PSYCHOPEDAGOGICAL observations from PRECEPTOR role (rank 30)', async () => {
    // GIVEN a PRECEPTOR user (rank 30) — below DIRECTOR (rank 50)
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['PRECEPTOR'],
    });

    // THEN PSYCHOPEDAGOGICAL is still hidden (threshold is 50, not 30)
    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── DIRECTOR (rank 50) sees all ──────────────────────────────────────────────

  it('returns all observations for DIRECTOR role (rank 50)', async () => {
    // GIVEN a DIRECTOR user (rank 50)
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['DIRECTOR'],
    });

    // THEN both observation types are returned
    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(2);
  });

  // ── ADMIN (rank 60) sees all ─────────────────────────────────────────────────

  it('returns all observations for ADMIN role (rank 60)', async () => {
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['ADMIN'],
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
  });

  // ── TUTOR (rank 10) — PSYCHOPEDAGOGICAL hidden (rank < 20, even lower) ──────

  it('hides PSYCHOPEDAGOGICAL observations from TUTOR role (rank 10)', async () => {
    // GIVEN a TUTOR user (rank 10) — would be blocked by RankGuard at HTTP level,
    // but the use case also enforces the rule independently
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['TUTOR'],
    });

    expect(result.isOk()).toBe(true);
    const obs = result.unwrap();
    expect(obs).toHaveLength(1);
    expect(obs[0].type.value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  // ── Multiple roles — highest rank wins ──────────────────────────────────────

  it('uses the highest rank among multiple roles', async () => {
    // GIVEN a user with both TEACHER and DIRECTOR roles
    const result = await useCase.execute({
      studentId: Id.create().get(),
      callerRoles: ['TEACHER', 'DIRECTOR'],
    });

    // THEN DIRECTOR rank (50) wins, all observations visible
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
  });
});
