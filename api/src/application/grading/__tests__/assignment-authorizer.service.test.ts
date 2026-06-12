/**
 * F5-T1..T7 [RED → GREEN] — AssignmentAuthorizer unit tests.
 *
 * Covers Fase 5 authorization scenarios for grade writes:
 *   F5-T6: ROOT → bypass (always permitted)
 *   F5-T7: SECRETARIO / DIRECTOR / ADMIN → permitted (D3 management bypass)
 *   F5-T4: TEACHER with assigned group → permitted
 *   F5-T1: TEACHER not assigned to any group for the subject → rejected (bug closed)
 *   F5-T3: TEACHER assigned to different subject (no group for this materia) → rejected
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignmentAuthorizer } from '../assignment-authorizer.service';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

interface MockRepos {
  docenteRepo: {
    findByUserAndCycle: ReturnType<typeof vi.fn>;
  };
  grupoRepo: {
    findGroupsForDocente: ReturnType<typeof vi.fn>;
  };
  mockClient: {
    courseCycle: { findUnique: ReturnType<typeof vi.fn> };
    materiaXCursoXCiclo: { findFirst: ReturnType<typeof vi.fn> };
  };
}

function makeRepos(overrides: Partial<{
  docenteXCiclo: { id: string; userId: string; cycleId: string } | null;
  grupos: { id: string; materiaXCursoXCicloId: string; docenteXCicloId: string }[];
  courseCycle: { cycleId: string } | null;
  materia: { id: string } | null;
}> = {}): MockRepos {
  const dxc = overrides.docenteXCiclo !== undefined
    ? overrides.docenteXCiclo
    : { id: 'dxc-1', userId: 'user-1', cycleId: 'cycle-1' };

  const grupos = overrides.grupos !== undefined
    ? overrides.grupos
    : [{ id: 'grupo-1', materiaXCursoXCicloId: 'materia-1', docenteXCicloId: 'dxc-1' }];

  const cc = overrides.courseCycle !== undefined
    ? overrides.courseCycle
    : { cycleId: 'cycle-1' };

  const materia = overrides.materia !== undefined
    ? overrides.materia
    : { id: 'materia-1' };

  return {
    docenteRepo: {
      findByUserAndCycle: vi.fn().mockResolvedValue(dxc),
    },
    grupoRepo: {
      findGroupsForDocente: vi.fn().mockResolvedValue(grupos),
    },
    mockClient: {
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue(cc),
      },
      materiaXCursoXCiclo: {
        findFirst: vi.fn().mockResolvedValue(materia),
      },
    },
  };
}

function makeAuthorizer(repos: MockRepos): AssignmentAuthorizer {
  return new AssignmentAuthorizer(
    repos.docenteRepo as any,
    repos.grupoRepo as any,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AssignmentAuthorizer
// ═══════════════════════════════════════════════════════════════════════════════

describe('AssignmentAuthorizer', () => {
  let repos: MockRepos;

  beforeEach(() => {
    repos = makeRepos();
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
  });

  // ── Management bypass (D3) ──────────────────────────────────────────────────

  it('F5-T6: ROOT → permitted without any DB lookups', async () => {
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-root', ['ROOT'], 'cc-1', 'subj-1');
    expect(result).toBe(true);
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
    expect(repos.grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
  });

  it('F5-T7: SECRETARIO → permitted (D3 management bypass)', async () => {
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-sec', ['SECRETARIO'], 'cc-1', 'subj-1');
    expect(result).toBe(true);
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
  });

  it('F5-T7: DIRECTOR → permitted (D3 management bypass)', async () => {
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-dir', ['DIRECTOR'], 'cc-1', 'subj-1');
    expect(result).toBe(true);
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
  });

  it('F5-T7: ADMIN → permitted (D3 management bypass)', async () => {
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-admin', ['ADMIN'], 'cc-1', 'subj-1');
    expect(result).toBe(true);
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
  });

  // ── Teacher group assignment checks ────────────────────────────────────────

  it('F5-T4: TEACHER with assigned group → permitted', async () => {
    // docenteXCiclo found, group found for this materia
    repos = makeRepos({
      docenteXCiclo: { id: 'dxc-1', userId: 'user-teacher', cycleId: 'cycle-1' },
      grupos: [{ id: 'grupo-1', materiaXCursoXCicloId: 'materia-1', docenteXCicloId: 'dxc-1' }],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-1');
    expect(result).toBe(true);
  });

  it('F5-T1: TEACHER with no DocenteXCiclo record → rejected (bug closed)', async () => {
    repos = makeRepos({ docenteXCiclo: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-1');
    expect(result).toBe(false);
  });

  it('F5-T1: TEACHER with DocenteXCiclo but no group for this materia → rejected', async () => {
    repos = makeRepos({
      docenteXCiclo: { id: 'dxc-1', userId: 'user-teacher', cycleId: 'cycle-1' },
      grupos: [], // no groups for this materia
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-1');
    expect(result).toBe(false);
  });

  it('F5-T3: TEACHER assigned to a DIFFERENT subject (different materia) → rejected', async () => {
    // docenteXCiclo exists but findGroupsForDocente returns empty for THIS materia
    repos = makeRepos({
      docenteXCiclo: { id: 'dxc-1', userId: 'user-teacher', cycleId: 'cycle-1' },
      grupos: [], // no groups for this specific (docenteXCicloId, materiaId) combo
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-other');
    expect(result).toBe(false);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('TEACHER when course cycle not found in tenant → rejected', async () => {
    repos = makeRepos({ courseCycle: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-unknown', 'subj-1');
    expect(result).toBe(false);
  });

  it('TEACHER when materia not yet materialized (no MateriaXCursoXCiclo row) → rejected', async () => {
    repos = makeRepos({
      docenteXCiclo: { id: 'dxc-1', userId: 'user-teacher', cycleId: 'cycle-1' },
      materia: null, // MateriaXCursoXCiclo not found
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-1');
    expect(result).toBe(false);
  });

  it('TenantContext not available → rejected', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);
    const auth = makeAuthorizer(repos);
    const result = await auth.canWriteGrades('user-teacher', ['TEACHER'], 'cc-1', 'subj-1');
    expect(result).toBe(false);
  });
});
