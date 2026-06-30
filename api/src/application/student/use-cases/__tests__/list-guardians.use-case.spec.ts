/**
 * ListGuardiansUseCase — error-path unit tests.
 * TDD Phase 2 — TASK-03 (RED): student not found must return err(NotFoundError), not throw.
 *
 * Satisfies: REQ-01, REQ-05, REQ-09-B
 */
import { describe, it, expect, vi } from 'vitest';
import { ListGuardiansUseCase } from '../student.use-cases';
import { NotFoundError } from '@educandow/domain';
import type { StudentRepository, StudentGuardianRepository } from '@educandow/domain';

// ── mock factories ────────────────────────────────────────────────────────────

function makeStudentRepo(student: unknown = null): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(student),
    findByUserId: vi.fn().mockResolvedValue(null),
    findByDni: vi.fn().mockResolvedValue(null),
    findByInstitution: vi.fn().mockResolvedValue([]),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    setFechaDePase: vi.fn().mockResolvedValue(undefined),
  } as unknown as StudentRepository;
}

function makeGuardianRepo(): StudentGuardianRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByStudentId: vi.fn().mockResolvedValue([]),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    findByComposite: vi.fn().mockResolvedValue(null),
    findStudyTutor: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as StudentGuardianRepository;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('ListGuardiansUseCase — REQ-01 / REQ-09-B', () => {
  describe('student not found', () => {
    it('returns err(NotFoundError) instead of throwing when student does not exist', async () => {
      const uc = new ListGuardiansUseCase(makeStudentRepo(null), makeGuardianRepo());

      const result = await uc.execute('non-existent-id');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it('does NOT call guardian repo when student is not found', async () => {
      const guardianRepo = makeGuardianRepo();
      const uc = new ListGuardiansUseCase(makeStudentRepo(null), guardianRepo);

      await uc.execute('non-existent-id');

      expect(guardianRepo.findByStudentId).not.toHaveBeenCalled();
    });
  });
});
