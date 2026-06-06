import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateObservationUseCase } from '../create-observation.use-case';
import type { StudentObservationRepository } from '@educandow/domain';
import { ForbiddenError } from '@educandow/domain';

describe('CreateObservationUseCase — PSYCHOPEDAGOGICAL authorization', () => {
  let useCase: CreateObservationUseCase;
  let repo: StudentObservationRepository;

  const validStudentId = 'student-uuid-1';
  const validAuthorId = 'author-uuid-1';

  beforeEach(() => {
    repo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByStudentIds: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new CreateObservationUseCase(repo);
  });

  // ── Spec scenario: TEACHER can create PEDAGOGICAL ────────────────────────────

  it('allows TEACHER (rank 20) to create PEDAGOGICAL observation', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: 'Class performance is good.',
      authorRoles: ['TEACHER'],
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  // ── Spec scenario: PSYCHOPEDAGOGICAL enforced inside use case (not guard) ───

  it('rejects TEACHER (rank 20) creating PSYCHOPEDAGOGICAL observation', async () => {
    // GIVEN a TEACHER user (rank 20) who passed the rank guard
    // WHEN the use case evaluates type PSYCHOPEDAGOGICAL against rank < 50
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PSYCHOPEDAGOGICAL',
      content: 'Psychological evaluation notes.',
      authorRoles: ['TEACHER'],
    });

    // THEN the use case returns a ForbiddenError
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

  // ── DIRECTOR (rank 50) CAN create PSYCHOPEDAGOGICAL ─────────────────────────

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

  // ── Content validation flows through entity Result ────────────────────────────

  it('returns err for empty content (entity validation via Result)', async () => {
    const result = await useCase.execute({
      studentId: validStudentId,
      authorId: validAuthorId,
      type: 'PEDAGOGICAL',
      content: '',
      authorRoles: ['TEACHER'],
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
    });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // ── Invalid type ─────────────────────────────────────────────────────────────

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
});
