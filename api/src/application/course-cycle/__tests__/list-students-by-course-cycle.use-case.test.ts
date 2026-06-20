/**
 * ListStudentsByCourseCycleUseCase — unit tests (TDD, T-09, SDD-1)
 * Covers: S-03 (enriched list), S-04 (empty list — not a 404)
 *
 * No real DB — repo is mocked via vi.fn().
 */
import { describe, it, expect, vi } from 'vitest';
import { ListStudentsByCourseCycleUseCase } from '../list-students-by-course-cycle.use-case';
import type { AlumnosXCursoXCicloRepository, AlumnoCursoCicloEnriched } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRepo(result: AlumnoCursoCicloEnriched[] = []): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue(result),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(null),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ListStudentsByCourseCycleUseCase', () => {
  it('delegates to repo.findByCourseCycleEnriched with the given courseCycleId', async () => {
    const repo = makeRepo();
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    await uc.execute('cc-1');

    expect(repo.findByCourseCycleEnriched).toHaveBeenCalledWith('cc-1');
    expect(repo.findByCourseCycleEnriched).toHaveBeenCalledTimes(1);
  });

  it('S-04: returns empty array when no students assigned — NOT a 404', async () => {
    const repo = makeRepo([]);
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    const result = await uc.execute('cc-1');

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('S-03: returns enriched list of students with names', async () => {
    const enriched: AlumnoCursoCicloEnriched[] = [
      { id: 'axcc-1', studentId: 's-1', studentName: 'Ana García', printable: false },
      { id: 'axcc-2', studentId: 's-2', studentName: 'Carlos López', printable: true },
    ];
    const repo = makeRepo(enriched);
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    const result = await uc.execute('cc-1');

    expect(result).toHaveLength(2);
    expect(result).toEqual(enriched);
    expect(result[0].studentName).toBe('Ana García');
  });

  it('propagates error when repo throws (no tenant client)', async () => {
    const repo = makeRepo();
    (repo.findByCourseCycleEnriched as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('TenantContext: no tenant client available for this request'),
    );
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    await expect(uc.execute('cc-1')).rejects.toThrow(
      'TenantContext: no tenant client available for this request',
    );
  });
});
