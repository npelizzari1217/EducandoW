import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateObservationUseCase } from '../create-observation.use-case';
import type { StudentObservationRepository } from '@educandow/domain';
import { ForbiddenError } from '@educandow/domain';

describe('CreateObservationUseCase — PSYCHOPEDAGOGICAL authorization + academicCycleId', () => {
  let useCase: CreateObservationUseCase;
  let repo: StudentObservationRepository;

  const validStudentId = 'student-uuid-1';
  const validAuthorId = 'author-uuid-1';
  const validCycleId = 'academic-cycle-uuid';

  beforeEach(() => {
    repo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByStudentIds: vi.fn(),
      findByAcademicCycleId: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    } as unknown as StudentObservationRepository;
    useCase = new CreateObservationUseCase(repo);
  });

  // ── Spec scenario: TEACHER can create PEDAGOGICAL with academicCycleId ────

  it('allows TEACHER (rank 20) to create PEDAGOGICAL observation with academicCycleId', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: 'Class performance is good.',
      authorRoles: ['TEACHER'],
      academicCycleId: validCycleId,
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  // ── PSYCHOPEDAGOGICAL authorization ──────────────────────────────────────

  it('rejects TEACHER (rank 20) creating PSYCHOPEDAGOGICAL observation', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PSYCHOPEDAGOGICAL',
      content: 'Psychological evaluation notes.',
      authorRoles: ['TEACHER'],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects PRECEPTOR (rank 30) creating PSYCHOPEDAGOGICAL observation', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PSYCHOPEDAGOGICAL',
      content: 'Some notes.',
      authorRoles: ['PRECEPTOR'],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('allows DIRECTOR (rank 50) to create PSYCHOPEDAGOGICAL observation', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PSYCHOPEDAGOGICAL',
      content: 'Detailed psychological assessment.',
      authorRoles: ['DIRECTOR'],
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  // ── Content validation flows through entity Result ────────────────────────

  it('returns err for empty content (entity validation via Result)', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: '',
      authorRoles: ['TEACHER'],
      academicCycleId: validCycleId,
    });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns err for content over 2000 characters', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: 'x'.repeat(2001),
      authorRoles: ['TEACHER'],
      academicCycleId: validCycleId,
    });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // ── Invalid type ──────────────────────────────────────────────────────────

  it('returns err for unknown observation type', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'INVALID',
      content: 'Some content.',
      authorRoles: ['TEACHER'],
    });

    expect(result.isErr()).toBe(true);
  });

  // ── academicCycleId invariant (ADR-3) ──────────────────────────────────

  it('returns err when PEDAGOGICAL observation has no academicCycleId', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: 'Missing cycle.',
      authorRoles: ['TEACHER'],
      // no academicCycleId
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('Pedagogical observations require an academic cycle');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows PEDAGOGICAL observation with academicCycleId', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: 'Valid pedagogical note.',
      authorRoles: ['TEACHER'],
      academicCycleId: validCycleId,
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('returns err when PSYCHOPEDAGOGICAL observation has academicCycleId', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PSYCHOPEDAGOGICAL',
      content: 'EOE note with wrong context.',
      authorRoles: ['DIRECTOR'],
      academicCycleId: validCycleId,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('Psychopedagogical observations cannot be linked to an academic cycle');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
