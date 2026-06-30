/**
 * RemoveGuardianUseCase — error-path and success unit tests.
 * TDD Phase 3 — TASK-06 (RED): both not-found sites must return err(NotFoundError);
 * success must return ok(undefined).
 *
 * Satisfies: REQ-01, REQ-04, REQ-09-B
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoveGuardianUseCase } from '../student.use-cases';
import { NotFoundError, StudentGuardian, Id } from '@educandow/domain';
import type { StudentGuardianRepository } from '@educandow/domain';

// ── mock factories ────────────────────────────────────────────────────────────

function makeGuardian(studentId: string): StudentGuardian {
  return StudentGuardian.reconstruct({
    id: Id.create('guardian-1'),
    studentId,
    relationship: 'Padre',
    isFinancialResponsible: false,
    isAuthorizedToPickUp: false,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGuardianRepo(guardian: StudentGuardian | null): StudentGuardianRepository {
  return {
    findById: vi.fn().mockResolvedValue(guardian),
    findByStudentId: vi.fn().mockResolvedValue([]),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    findByComposite: vi.fn().mockResolvedValue(null),
    findStudyTutor: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as StudentGuardianRepository;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('RemoveGuardianUseCase — REQ-01 / REQ-04 / REQ-09-B', () => {
  describe('Test A — guardian not found', () => {
    it('returns err(NotFoundError) when guardian does not exist', async () => {
      const guardianRepo = makeGuardianRepo(null);
      const uc = new RemoveGuardianUseCase(guardianRepo);

      const result = await uc.execute('guardian-missing', 'student-1');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('Test B — studentId mismatch', () => {
    it('returns err(NotFoundError) when guardian belongs to a different student', async () => {
      // guardian.studentId = 'other-student', but we pass studentId = 'student-1'
      const guardian = makeGuardian('other-student');
      const guardianRepo = makeGuardianRepo(guardian);
      const uc = new RemoveGuardianUseCase(guardianRepo);

      const result = await uc.execute('guardian-1', 'student-1');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('Test C — happy path', () => {
    it('returns ok(undefined) and calls delete when guardian matches student', async () => {
      const guardian = makeGuardian('student-1');
      const guardianRepo = makeGuardianRepo(guardian);
      const uc = new RemoveGuardianUseCase(guardianRepo);

      const result = await uc.execute('guardian-1', 'student-1');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeUndefined();
      expect(guardianRepo.delete).toHaveBeenCalledWith('guardian-1');
    });
  });
});
