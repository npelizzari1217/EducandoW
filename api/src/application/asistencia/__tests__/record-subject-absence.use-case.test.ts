/**
 * RecordSubjectAbsenceUseCase tests — Fase 6
 * F6-T1: assigned teacher + module → success
 * F6-T2: unassigned teacher → ForbiddenError
 * F6-T4: SECRETARIO (D3) → bypass, success
 * F6-T5: split subject — D1 for G1, D2 for G2 → both succeed independently
 * TDD: RED → GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordSubjectAbsenceUseCase } from '../record-subject-absence.use-case';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';
import {
  AusenciaXGrupo,
  GrupoXCursoXMateriaXCiclo,
  DocenteXCiclo,
  type SubjectAbsenceRepository,
  type GrupoRepository,
  type DocenteXCicloRepository,
} from '@educandow/domain';
import { ForbiddenError } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── helpers ────────────────────────────────────────────────────────────────────

const date = new Date('2026-08-10');

function makeGrupo(id: string, materiaId: string, docenteXCicloId: string): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeDocente(id: string, userId: string, cycleId: string): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId,
    cycleId,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAusencia(grupoId: string, studentId: string): AusenciaXGrupo {
  return AusenciaXGrupo.create({ grupoId, studentId, date });
}

interface Repos {
  absenceRepo: SubjectAbsenceRepository;
  grupoRepo: GrupoRepository;
  docenteRepo: DocenteXCicloRepository;
  mockClient: {
    materiaXCursoXCiclo: { findUnique: ReturnType<typeof vi.fn> };
    courseCycle: { findUnique: ReturnType<typeof vi.fn> };
  };
}

function makeRepos(overrides: {
  grupo?: GrupoXCursoXMateriaXCiclo | null;
  docente?: DocenteXCiclo | null;
  materia?: { courseCycleId: string } | null;
  courseCycle?: { cycleId: string } | null;
} = {}): Repos {
  const grupo = overrides.grupo !== undefined
    ? overrides.grupo
    : makeGrupo('grupo-1', 'materia-1', 'dxc-1');

  const docente = overrides.docente !== undefined
    ? overrides.docente
    : makeDocente('dxc-1', 'user-1', 'cycle-1');

  const materia = overrides.materia !== undefined
    ? overrides.materia
    : { courseCycleId: 'cc-1' };

  const cc = overrides.courseCycle !== undefined
    ? overrides.courseCycle
    : { cycleId: 'cycle-1' };

  const mockClient = {
    materiaXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue(materia),
    },
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(cc),
    },
  };

  return {
    absenceRepo: {
      record: vi.fn().mockImplementation(async (data) => makeAusencia(data.grupoId, data.studentId)),
      findByGrupoAndDate: vi.fn().mockResolvedValue([]),
      findByGrupoAndStudent: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    grupoRepo: {
      findById: vi.fn().mockResolvedValue(grupo),
      findByMateria: vi.fn().mockResolvedValue([]),
      findByDocente: vi.fn().mockResolvedValue([]),
      findGroupsForDocente: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    docenteRepo: {
      findById: vi.fn().mockResolvedValue(docente),
      findByUserId: vi.fn().mockResolvedValue(docente ? [docente] : []),
      findByCycleId: vi.fn().mockResolvedValue(docente ? [docente] : []),
      findByUserAndCycle: vi.fn().mockResolvedValue(docente),
      upsert: vi.fn().mockResolvedValue(docente),
    },
    mockClient,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('RecordSubjectAbsenceUseCase', () => {
  let repos: Repos;

  beforeEach(() => {
    repos = makeRepos();
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
  });

  // F6-T1: assigned teacher → absence recorded
  it('F6-T1: teacher assigned to the group records absence successfully', async () => {
    const uc = new RecordSubjectAbsenceUseCase(
      repos.absenceRepo,
      repos.grupoRepo as any,
      repos.docenteRepo as any,
    );

    const result = await uc.execute({
      grupoId: 'grupo-1',
      studentId: 'student-1',
      date,
      userId: 'user-1',
      userRoles: ['TEACHER'],
    });

    expect(result.grupoId).toBe('grupo-1');
    expect(result.studentId).toBe('student-1');
    expect(repos.absenceRepo.record).toHaveBeenCalledOnce();
  });

  // F6-T2: teacher NOT assigned to the group → ForbiddenError
  it('F6-T2: teacher not assigned to group → ForbiddenError', async () => {
    // grupo-1 is assigned to dxc-1, but teacher is dxc-2
    const grupo = makeGrupo('grupo-1', 'materia-1', 'dxc-1');
    const docente = makeDocente('dxc-2', 'user-2', 'cycle-1'); // different dxc
    repos = makeRepos({ grupo, docente });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordSubjectAbsenceUseCase(
      repos.absenceRepo,
      repos.grupoRepo as any,
      repos.docenteRepo as any,
    );

    await expect(
      uc.execute({
        grupoId: 'grupo-1',
        studentId: 'student-1',
        date,
        userId: 'user-2',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(repos.absenceRepo.record).not.toHaveBeenCalled();
  });

  // F6-T4: SECRETARIO → D3 bypass, no Door 2 check
  it('F6-T4: SECRETARIO bypasses Door 2 (D3) and records absence', async () => {
    const uc = new RecordSubjectAbsenceUseCase(
      repos.absenceRepo,
      repos.grupoRepo as any,
      repos.docenteRepo as any,
    );

    const result = await uc.execute({
      grupoId: 'grupo-1',
      studentId: 'student-1',
      date,
      userId: 'user-sec',
      userRoles: ['SECRETARIO'],
    });

    expect(result.grupoId).toBe('grupo-1');
    // D3: no group check performed
    expect(repos.grupoRepo.findById).not.toHaveBeenCalled();
    expect(repos.docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
    expect(repos.absenceRepo.record).toHaveBeenCalledOnce();
  });

  // F6-T5: split subject — D1 records G1 → success; D2 records G2 → success (no conflict)
  it('F6-T5: split subject — D1 records G1, D2 records G2 independently', async () => {
    // D1 in G1
    const grupo1 = makeGrupo('grupo-1', 'materia-1', 'dxc-1');
    const docente1 = makeDocente('dxc-1', 'user-1', 'cycle-1');
    const repos1 = makeRepos({ grupo: grupo1, docente: docente1 });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos1.mockClient as any);

    const uc1 = new RecordSubjectAbsenceUseCase(
      repos1.absenceRepo,
      repos1.grupoRepo as any,
      repos1.docenteRepo as any,
    );

    const r1 = await uc1.execute({
      grupoId: 'grupo-1',
      studentId: 'student-1',
      date,
      userId: 'user-1',
      userRoles: ['TEACHER'],
    });

    // D2 in G2
    const grupo2 = makeGrupo('grupo-2', 'materia-1', 'dxc-2');
    const docente2 = makeDocente('dxc-2', 'user-2', 'cycle-1');
    const repos2 = makeRepos({ grupo: grupo2, docente: docente2 });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos2.mockClient as any);

    const uc2 = new RecordSubjectAbsenceUseCase(
      repos2.absenceRepo,
      repos2.grupoRepo as any,
      repos2.docenteRepo as any,
    );

    const r2 = await uc2.execute({
      grupoId: 'grupo-2',
      studentId: 'student-2',
      date,
      userId: 'user-2',
      userRoles: ['TEACHER'],
    });

    // Both succeed independently
    expect(r1.grupoId).toBe('grupo-1');
    expect(r2.grupoId).toBe('grupo-2');
    expect(repos1.absenceRepo.record).toHaveBeenCalledOnce();
    expect(repos2.absenceRepo.record).toHaveBeenCalledOnce();
  });

  // grupo not found → ForbiddenError (safe fallback)
  it('grupo not found → ForbiddenError', async () => {
    repos = makeRepos({ grupo: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordSubjectAbsenceUseCase(
      repos.absenceRepo,
      repos.grupoRepo as any,
      repos.docenteRepo as any,
    );

    await expect(
      uc.execute({
        grupoId: 'grupo-unknown',
        studentId: 'student-1',
        date,
        userId: 'user-1',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // docente not found for this cycle → ForbiddenError
  it('docenteXCiclo not found for user in cycle → ForbiddenError', async () => {
    repos = makeRepos({ docente: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);

    const uc = new RecordSubjectAbsenceUseCase(
      repos.absenceRepo,
      repos.grupoRepo as any,
      repos.docenteRepo as any,
    );

    await expect(
      uc.execute({
        grupoId: 'grupo-1',
        studentId: 'student-1',
        date,
        userId: 'user-x',
        userRoles: ['TEACHER'],
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
