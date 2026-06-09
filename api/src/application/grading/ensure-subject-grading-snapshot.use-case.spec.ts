/**
 * PR4-T1 [RED] — EnsureSubjectGradingSnapshotUseCase tests.
 * Specs: SPG-R2, AD-5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnsureSubjectGradingSnapshotUseCase } from './ensure-subject-grading-snapshot.use-case';
import { SubjectGradingPeriod } from '@educandow/domain';

function makePeriod(periodOrdinal: number): SubjectGradingPeriod {
  return SubjectGradingPeriod.snapshotFromTemplateItem({
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-uuid-1',
    sortOrder: periodOrdinal,
    name: `Período ${periodOrdinal}`,
  });
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]),
    ensureSnapshot: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EnsureSubjectGradingSnapshotUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('EnsureSubjectGradingSnapshotUseCase', () => {
  let useCase: EnsureSubjectGradingSnapshotUseCase;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new EnsureSubjectGradingSnapshotUseCase(repo as any);
  });

  it('first call: copies template items via ensureSnapshot and returns periods', async () => {
    const periods = [makePeriod(1), makePeriod(2), makePeriod(3)];
    repo.ensureSnapshot.mockResolvedValue(periods);

    const result = await useCase.execute('cc-uuid-1', 'subj-uuid-1');

    expect(repo.ensureSnapshot).toHaveBeenCalledWith('cc-uuid-1', 'subj-uuid-1');
    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(SubjectGradingPeriod);
  });

  it('second call is a no-op (returns existing rows from repo)', async () => {
    const existing = [makePeriod(1), makePeriod(2)];
    repo.ensureSnapshot.mockResolvedValue(existing);

    const result = await useCase.execute('cc-uuid-1', 'subj-uuid-1');

    expect(repo.ensureSnapshot).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
  });

  it('wrong/cross-tenant CC returns empty array without error', async () => {
    repo.ensureSnapshot.mockResolvedValue([]);

    const result = await useCase.execute('cc-other-tenant', 'subj-uuid-1');

    expect(result).toHaveLength(0);
    // No exception thrown
  });

  it('delegates directly to the repository ensureSnapshot', async () => {
    await useCase.execute('cc-uuid-1', 'subj-uuid-1');

    expect(repo.ensureSnapshot).toHaveBeenCalledWith('cc-uuid-1', 'subj-uuid-1');
  });
});
