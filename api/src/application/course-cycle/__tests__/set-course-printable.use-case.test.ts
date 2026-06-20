/**
 * SetCoursePrintableUseCase — unit tests (TDD, T02, SDD-2 PR-1)
 * Covers: Scenario F (Todos=true), Scenario G (Ninguno=false), Scenario H (tenant isolation)
 * REQ-TOG-2, REQ-TOG-3, REQ-TOG-4
 *
 * No real DB — repo is mocked via vi.fn().
 * Tests are RED until T06 implements the use-case.
 * Tenant isolation (Scenario H) is enforced at the Prisma layer via TenantContext;
 * unit test verifies the use-case calls setPrintableBulk with (courseCycleId, value).
 */
import { describe, it, expect, vi } from 'vitest';
import { SetCoursePrintableUseCase } from '../set-course-printable.use-case';
import type { AlumnosXCursoXCicloRepository } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeAlumnosRepo(): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(undefined),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
  } as unknown as AlumnosXCursoXCicloRepository;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SetCoursePrintableUseCase', () => {
  it('Scenario F (Todos): bulk-sets printable=true for all rows in CC', async () => {
    const repo = makeAlumnosRepo();
    const uc = new SetCoursePrintableUseCase(repo);

    await uc.execute({ courseCycleId: 'cc-1', value: true });

    expect(repo.setPrintableBulk).toHaveBeenCalledWith('cc-1', true);
    expect(repo.setPrintableBulk).toHaveBeenCalledTimes(1);
  });

  it('Scenario G (Ninguno): bulk-sets printable=false for all rows in CC', async () => {
    const repo = makeAlumnosRepo();
    const uc = new SetCoursePrintableUseCase(repo);

    await uc.execute({ courseCycleId: 'cc-1', value: false });

    expect(repo.setPrintableBulk).toHaveBeenCalledWith('cc-1', false);
    expect(repo.setPrintableBulk).toHaveBeenCalledTimes(1);
  });

  it('Scenario H (tenant isolation): only scopes to the given courseCycleId', async () => {
    // Tenant isolation is enforced at the Prisma layer (TenantContext); here we
    // verify the use-case only passes the target courseCycleId to setPrintableBulk.
    const repo = makeAlumnosRepo();
    const uc = new SetCoursePrintableUseCase(repo);

    await uc.execute({ courseCycleId: 'cc-T1', value: false });

    expect(repo.setPrintableBulk).toHaveBeenCalledWith('cc-T1', false);
    // No other courseCycleId was passed (T2 isolation preserved at DB layer)
    expect(repo.setPrintableBulk).not.toHaveBeenCalledWith('cc-T2', expect.anything());
  });

  it('is idempotent: calling with same value again is safe', async () => {
    const repo = makeAlumnosRepo();
    const uc = new SetCoursePrintableUseCase(repo);

    await uc.execute({ courseCycleId: 'cc-1', value: true });
    await uc.execute({ courseCycleId: 'cc-1', value: true });

    expect(repo.setPrintableBulk).toHaveBeenCalledTimes(2);
    expect(repo.setPrintableBulk).toHaveBeenNthCalledWith(1, 'cc-1', true);
    expect(repo.setPrintableBulk).toHaveBeenNthCalledWith(2, 'cc-1', true);
  });
});
