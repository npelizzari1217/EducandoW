/**
 * UpdateGrupoUseCase — unit tests (TDD)
 * Covers: rename only, reassign teacher, not-found, invalid teacher level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateGrupoUseCase } from '../update-grupo.use-case';
import type { GrupoRepository, MateriaXCursoXCicloRepository } from '@educandow/domain';
import {
  GrupoXCursoXMateriaXCiclo,
  MateriaXCursoXCiclo,
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

vi.mock('../validate-teacher-level', () => ({
  validateTeacherLevel: vi.fn().mockResolvedValue(undefined),
}));

import { validateTeacherLevel } from '../validate-teacher-level';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGrupo(id = 'g-1', materiaId = 'm-1', dxcId = 'dxc-1'): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId: dxcId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMateria(id = 'm-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-1',
    esOptativa: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeDocenteXCiclo(id = 'dxc-2'): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId: 'user-2',
    cycleId: 'cycle-1',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupoRepo(grupo: GrupoXCursoXMateriaXCiclo | null): GrupoRepository {
  return {
    findById: vi.fn().mockResolvedValue(grupo),
    findByMateria: vi.fn(),
    findByDocente: vi.fn(),
    findGroupsForDocente: vi.fn(),
    create: vi.fn(),
    findAllGlobal: vi.fn(),
    update: vi.fn().mockImplementation((id, data) =>
      Promise.resolve(
        GrupoXCursoXMateriaXCiclo.reconstruct({
          id,
          materiaXCursoXCicloId: grupo?.materiaXCursoXCicloId ?? 'm-1',
          docenteXCicloId: data.docenteXCicloId ?? grupo?.docenteXCicloId ?? 'dxc-1',
          name: data.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    ),
    delete: vi.fn(),
  };
}

function makeMateriaRepo(materia: MateriaXCursoXCiclo | null): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn(),
    upsertMany: vi.fn(),
    updateDescription: vi.fn(),
    setEsOptativa: vi.fn(),
  };
}

function makeDocenteRepo(dxc: DocenteXCiclo): DocenteXCicloRepository {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByCycleId: vi.fn(),
    findByUserAndCycle: vi.fn(),
    upsert: vi.fn().mockResolvedValue(dxc),
  };
}

function makeTenantClient(cycleId = 'cycle-1') {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ cycleId }),
    },
    docenteXCiclo: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    },
  };
}

function makePrismaService() {
  return {
    getMasterClient: () => ({
      user: { findUnique: vi.fn() },
    }),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('UpdateGrupoUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient() as any);
  });

  it('rename only — does NOT call materiaRepo, validateTeacherLevel or docenteService', async () => {
    const grupo = makeGrupo();
    const grupoRepo = makeGrupoRepo(grupo);
    const materiaRepo = makeMateriaRepo(makeMateria());
    const dxc = makeDocenteXCiclo();
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);
    await uc.execute({ id: 'g-1', name: 'Grupo Nuevo' });

    expect(grupoRepo.update).toHaveBeenCalledWith('g-1', { name: 'Grupo Nuevo', docenteXCicloId: undefined });
    expect(materiaRepo.findById).not.toHaveBeenCalled();
    expect(validateTeacherLevel).not.toHaveBeenCalled();
  });

  it('reassign teacher — calls materiaRepo, validateTeacherLevel, docenteService, grupoRepo.update', async () => {
    const grupo = makeGrupo();
    const materia = makeMateria();
    const grupoRepo = makeGrupoRepo(grupo);
    const materiaRepo = makeMateriaRepo(materia);
    const dxc = makeDocenteXCiclo('dxc-new');
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    vi.spyOn(docenteService, 'getOrCreateForCycle').mockResolvedValue(dxc);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);
    await uc.execute({ id: 'g-1', userId: 'user-2' });

    expect(materiaRepo.findById).toHaveBeenCalledWith('m-1');
    expect(validateTeacherLevel).toHaveBeenCalledWith(prisma, 'user-2', 'cc-uuid-1');
    expect(docenteService.getOrCreateForCycle).toHaveBeenCalledWith('user-2', 'cycle-1');
    expect(grupoRepo.update).toHaveBeenCalledWith('g-1', {
      name: undefined,
      docenteXCicloId: 'dxc-new',
    });
  });

  it('throws NotFoundError when grupo does not exist', async () => {
    const grupoRepo = makeGrupoRepo(null);
    const materiaRepo = makeMateriaRepo(null);
    const docenteRepo = makeDocenteRepo(makeDocenteXCiclo());
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);

    await expect(uc.execute({ id: 'non-existent', name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    expect(grupoRepo.update).not.toHaveBeenCalled();
  });

  it('propagates ValidationError when validateTeacherLevel rejects', async () => {
    vi.mocked(validateTeacherLevel).mockRejectedValueOnce(
      new ValidationError('La materia no pertenece al nivel del docente'),
    );

    const grupo = makeGrupo();
    const materia = makeMateria();
    const grupoRepo = makeGrupoRepo(grupo);
    const materiaRepo = makeMateriaRepo(materia);
    const dxc = makeDocenteXCiclo();
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);

    await expect(uc.execute({ id: 'g-1', userId: 'user-bad' })).rejects.toBeInstanceOf(ValidationError);
    expect(grupoRepo.update).not.toHaveBeenCalled();
  });
});
