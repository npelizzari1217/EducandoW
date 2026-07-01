/**
 * ListGruposGlobalUseCase — unit tests (TDD)
 * Covers scope-based filtering: ROOT, DIRECTOR (administrative), TEACHER.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListGruposGlobalUseCase } from '../list-grupos-global.use-case';
import type { GrupoRepository, DocenteXCicloRepository, GrupoGlobalRow } from '@educandow/domain';
import { DocenteXCiclo } from '@educandow/domain';

// Mock resolveAccessScope so we can control scope per test
vi.mock('@educandow/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@educandow/domain')>();
  return { ...actual, resolveAccessScope: vi.fn() };
});

import { resolveAccessScope } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGrupoRow(id: string, level = 20): GrupoGlobalRow {
  return {
    id,
    docenteXCicloId: 'dxc-1',
    docenteUserId: 'user-1',
    materiaId: 'mat-1',
    subjectId: 'subj-1',
    subjectName: 'Matemática',
    courseCycleId: 'cc-uuid-1',
    courseName: 'Primero',
    level,
    alumnosCount: 5,
  };
}

function makeDocenteXCiclo(id: string, userId = 'user-1'): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId,
    cycleId: 'cycle-1',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupoRepo(rows: GrupoGlobalRow[] = []): GrupoRepository {
  return {
    findById: vi.fn(),
    findByMateria: vi.fn(),
    findByDocente: vi.fn(),
    findGroupsForDocente: vi.fn(),
    create: vi.fn(),
    findAllGlobal: vi.fn().mockResolvedValue(rows),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function makeDocenteRepo(docentes: DocenteXCiclo[] = []): DocenteXCicloRepository {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue(docentes),
    findByCycleId: vi.fn(),
    findByUserAndCycle: vi.fn(),
    upsert: vi.fn(),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('ListGruposGlobalUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ROOT — allLevels=true', () => {
    beforeEach(() => {
      vi.mocked(resolveAccessScope).mockReturnValue({
        allLevels: true,
        isAdministrative: true,
        compositeLevels: [],
        baseLevels: [],
      });
    });

    it('passes level filter as-is to repo', async () => {
      const rows = [makeGrupoRow('g-1', 20)];
      const grupoRepo = makeGrupoRepo(rows);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      const result = await uc.execute(
        { roles: ['ROOT'], userId: 'root-user' },
        { level: 20 },
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith({ level: 20 });
      expect(result).toHaveLength(1);
    });

    it('returns all groups without level filter', async () => {
      const rows = [makeGrupoRow('g-1', 20), makeGrupoRow('g-2', 30)];
      const grupoRepo = makeGrupoRepo(rows);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      const result = await uc.execute(
        { roles: ['ROOT'], userId: 'root-user' },
        {},
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith({});
      expect(result).toHaveLength(2);
    });

    it('passes courseCycleId and materiaId filters', async () => {
      const grupoRepo = makeGrupoRepo([]);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      await uc.execute(
        { roles: ['ROOT'], userId: 'root-user' },
        { courseCycleId: 'cc-uuid-1', materiaId: 'mat-uuid-1' },
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith({
        courseCycleId: 'cc-uuid-1',
        materiaId: 'mat-uuid-1',
      });
    });
  });

  describe('DIRECTOR — !allLevels, isAdministrative=true, compositeLevels=[10, 20]', () => {
    beforeEach(() => {
      vi.mocked(resolveAccessScope).mockReturnValue({
        allLevels: false,
        isAdministrative: true,
        compositeLevels: [10, 20],
        baseLevels: [1, 2],
      });
    });

    it('without level filter → uses levelIn: [10, 20]', async () => {
      const grupoRepo = makeGrupoRepo([makeGrupoRow('g-1', 10)]);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      await uc.execute(
        { roles: ['DIRECTOR'], levels: [10, 20], userId: 'dir-user' },
        {},
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ levelIn: [10, 20] }),
      );
    });

    it('with level=20 (in scope) → uses level: 20', async () => {
      const grupoRepo = makeGrupoRepo([makeGrupoRow('g-1', 20)]);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      await uc.execute(
        { roles: ['DIRECTOR'], levels: [10, 20], userId: 'dir-user' },
        { level: 20 },
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ level: 20 }),
      );
    });

    it('with level=30 (outside scope) → returns [] without calling repo', async () => {
      const grupoRepo = makeGrupoRepo([makeGrupoRow('g-1', 30)]);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      const result = await uc.execute(
        { roles: ['DIRECTOR'], levels: [10, 20], userId: 'dir-user' },
        { level: 30 },
      );

      expect(grupoRepo.findAllGlobal).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('with empty compositeLevels → returns [] without calling repo', async () => {
      vi.mocked(resolveAccessScope).mockReturnValue({
        allLevels: false,
        isAdministrative: true,
        compositeLevels: [],
        baseLevels: [],
      });
      const grupoRepo = makeGrupoRepo([]);
      const docenteRepo = makeDocenteRepo();

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      const result = await uc.execute(
        { roles: ['DIRECTOR'], levels: [], userId: 'dir-user' },
        {},
      );

      expect(grupoRepo.findAllGlobal).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('TEACHER — not administrative', () => {
    beforeEach(() => {
      vi.mocked(resolveAccessScope).mockReturnValue({
        allLevels: false,
        isAdministrative: false,
        compositeLevels: [20],
        baseLevels: [2],
      });
    });

    it('filters by their docenteXCicloIds', async () => {
      const docentes = [makeDocenteXCiclo('dxc-1', 'teacher-user'), makeDocenteXCiclo('dxc-2', 'teacher-user')];
      const rows = [makeGrupoRow('g-1'), makeGrupoRow('g-2')];
      const grupoRepo = makeGrupoRepo(rows);
      const docenteRepo = makeDocenteRepo(docentes);

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      await uc.execute(
        { roles: ['TEACHER'], userId: 'teacher-user' },
        {},
      );

      expect(docenteRepo.findByUserId).toHaveBeenCalledWith('teacher-user');
      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ docenteXCicloIds: ['dxc-1', 'dxc-2'] }),
      );
    });

    it('returns [] when teacher has no docenteXCiclo records', async () => {
      const grupoRepo = makeGrupoRepo([]);
      const docenteRepo = makeDocenteRepo([]); // no docentes

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      const result = await uc.execute(
        { roles: ['TEACHER'], userId: 'teacher-user' },
        {},
      );

      expect(grupoRepo.findAllGlobal).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('passes level filter along with docenteXCicloIds', async () => {
      const docentes = [makeDocenteXCiclo('dxc-1', 'teacher-user')];
      const grupoRepo = makeGrupoRepo([makeGrupoRow('g-1', 20)]);
      const docenteRepo = makeDocenteRepo(docentes);

      const uc = new ListGruposGlobalUseCase(grupoRepo, docenteRepo);
      await uc.execute(
        { roles: ['TEACHER'], userId: 'teacher-user' },
        { level: 20 },
      );

      expect(grupoRepo.findAllGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ docenteXCicloIds: ['dxc-1'], level: 20 }),
      );
    });
  });
});
