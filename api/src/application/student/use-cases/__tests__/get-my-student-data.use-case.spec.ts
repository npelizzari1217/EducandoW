/**
 * Phase 4 — TASK-11 (RED)
 * Error-path unit test for GetMyStudentDataUseCase.
 * Must FAIL until TASK-14 (GREEN) migrates execute() to Result.
 */
import { describe, it, expect, vi } from 'vitest';
import { GetMyStudentDataUseCase } from '../student.use-cases';
import { NotFoundError, StudentRepository } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeStudentRepoWithNoStudent(): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    findByInstitution: vi.fn().mockResolvedValue([]),
    findByDni: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    setFechaDePase: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GetMyStudentDataUseCase — error paths (Phase 4 TDD)', () => {
  it('user has no linked student → err(NotFoundError)', async () => {
    const uc = new GetMyStudentDataUseCase(makeStudentRepoWithNoStudent());
    const result = await uc.execute('user-with-no-student');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });
});
