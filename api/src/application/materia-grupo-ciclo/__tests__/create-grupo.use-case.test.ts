/**
 * CreateGrupoUseCase — unit tests (TDD, Fase 3c)
 * Covers: F3-T7 (MGC-S7), F3-T8 (MGC-S8 split subject)
 *         + nivel validation (TASK-2)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateGrupoUseCase } from '../create-grupo.use-case';
import type {
  MateriaXCursoXCicloRepository,
  GrupoRepository,
} from '@educandow/domain';
import {
  MateriaXCursoXCiclo,
  GrupoXCursoXMateriaXCiclo,
  NotFoundError,
  ValidationError,
  DocenteXCiclo,
} from '@educandow/domain';
import { DocenteXCicloService } from '../../docente-ciclo/docente-x-ciclo.service';
import type { DocenteXCicloRepository } from '@educandow/domain';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMateria(id = 'm-1', courseCycleId = 'cc-uuid-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    subjectId: 'subj-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeDocenteXCiclo(id = 'dxc-1'): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId: 'user-1',
    cycleId: 'cycle-1',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupo(id = 'grupo-1', materiaId = 'm-1', dxcId = 'dxc-1'): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId: dxcId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMateriaRepo(materia: MateriaXCursoXCiclo | null): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn().mockResolvedValue([]),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn().mockResolvedValue(materia),
  };
}

function makeGrupoRepo(returnGrupo: GrupoXCursoXMateriaXCiclo): GrupoRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByMateria: vi.fn().mockResolvedValue([]),
    findByDocente: vi.fn().mockResolvedValue([]),
    findGroupsForDocente: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(returnGrupo),
  };
}

function makeDocenteRepo(dxc: DocenteXCiclo): DocenteXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(dxc),
    findByUserId: vi.fn().mockResolvedValue([dxc]),
    findByCycleId: vi.fn().mockResolvedValue([dxc]),
    findByUserAndCycle: vi.fn().mockResolvedValue(dxc),
    upsert: vi.fn().mockResolvedValue(dxc),
  };
}

/**
 * Creates a mock PrismaService for the tests.
 * @param roleNames - role names for the user (default: ['TEACHER'])
 * @param userLevels - composite level decomposed (default: [{ level: 2, modality: 0 }] = composite 20)
 */
function makePrismaService(
  roleNames: string[] = ['TEACHER'],
  userLevels: { level: number; modality: number }[] = [{ level: 2, modality: 0 }],
) {
  return {
    getMasterClient: () => ({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          userRoles: roleNames.map((name) => ({ role: { name } })),
          userLevels,
        }),
      },
    }),
  };
}

function makeTenantClient(ccLevel = 20) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ level: ccLevel }),
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CreateGrupoUseCase', () => {
  beforeEach(() => {
    // Default: tenant client returns CC with level 20
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(20) as any);
  });

  // ── Existing tests (preserved) ──────────────────────────────────────────────

  // F3-T7 / MGC-S7: normal subject — create 1 group
  it('creates a group for a materia with a docente (MGC-S7)', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo('dxc-1');
    const grupo = makeGrupo();

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    // Teacher with level 20, CC is level 20 → OK
    const prisma = makePrismaService(['TEACHER'], [{ level: 2, modality: 0 }]);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    const result = await uc.execute({
      materiaXCursoXCicloId: 'm-1',
      userId: 'user-1',
      cycleId: 'cycle-1',
    });

    expect(grupoRepo.create).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'm-1',
      docenteXCicloId: 'dxc-1',
      name: undefined,
    });
    expect(result.id).toBe('grupo-1');
  });

  // MGC-S8: split subject — two groups with different docentes
  it('allows creating a second group for a split subject (MGC-S8)', async () => {
    const materia = makeMateria();
    const dxc2 = makeDocenteXCiclo('dxc-2');
    const grupo2 = makeGrupo('grupo-2', 'm-1', 'dxc-2');

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo2);
    const docenteRepo = makeDocenteRepo(dxc2);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService(['TEACHER'], [{ level: 2, modality: 0 }]);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    const result = await uc.execute({
      materiaXCursoXCicloId: 'm-1',
      userId: 'user-2',
      cycleId: 'cycle-1',
      name: 'Comisión B',
    });

    expect(grupoRepo.create).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'm-1',
      docenteXCicloId: 'dxc-2',
      name: 'Comisión B',
    });
    expect(result.id).toBe('grupo-2');
  });

  it('throws NotFoundError when materia does not exist', async () => {
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    const materiaRepo = makeMateriaRepo(null);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent', userId: 'user-1', cycleId: 'cycle-1' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── Nivel validation tests (TASK-2) ────────────────────────────────────────

  it('NIVEL: rechaza cuando la materia es de un nivel que el docente NO tiene', async () => {
    const materia = makeMateria('m-1', 'cc-uuid-1');
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    // CC level = 30 (nivel 3, modalidad 0)
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(30) as any);
    // Teacher has level 20 only (nivel 2, modalidad 0)
    const prisma = makePrismaService(['TEACHER'], [{ level: 2, modality: 0 }]);

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'user-1', cycleId: 'cycle-1' })
    ).rejects.toThrow('La materia no pertenece al nivel del docente');
    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'user-1', cycleId: 'cycle-1' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('NIVEL: permite cuando la materia es del nivel del docente', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    // CC level = 20, teacher levels include 20 → OK
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(20) as any);
    const prisma = makePrismaService(['TEACHER'], [{ level: 2, modality: 0 }]);

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'user-1', cycleId: 'cycle-1' })
    ).resolves.toBeDefined();
  });

  it('NIVEL: ROOT (allLevels) puede asignar materia de cualquier nivel', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    // CC level = 50, ROOT has no levels restriction
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(50) as any);
    const prisma = makePrismaService(['ROOT'], []); // ROOT with empty userLevels

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'root-user', cycleId: 'cycle-1' })
    ).resolves.toBeDefined();
  });

  it('NIVEL: ADMIN (allLevels) puede asignar materia de cualquier nivel', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(99) as any);
    const prisma = makePrismaService(['ADMIN'], []);

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'admin-user', cycleId: 'cycle-1' })
    ).resolves.toBeDefined();
  });

  it('NIVEL: docente con múltiples niveles puede asignar materia de cualquiera de ellos', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo();
    const grupo = makeGrupo();

    // CC level = 31, teacher has levels [20, 31] → OK
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient(31) as any);
    const prisma = makePrismaService(['TEACHER'], [
      { level: 2, modality: 0 },   // composite 20
      { level: 3, modality: 1 },   // composite 31
    ]);

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma as any);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', userId: 'user-1', cycleId: 'cycle-1' })
    ).resolves.toBeDefined();
  });
});
