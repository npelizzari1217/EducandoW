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
  ok,
  err,
} from '@educandow/domain';
import { DocenteXCicloService } from '../../docente-ciclo/docente-x-ciclo.service';
import type { DocenteXCicloRepository } from '@educandow/domain';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

const { okUndefined } = vi.hoisted(() => ({
  okUndefined: { isOk: () => true, isErr: () => false, unwrap: () => undefined },
}));

vi.mock('../validate-teacher-level', () => ({
  validateTeacherLevel: vi.fn().mockResolvedValue(okUndefined),
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
    vi.mocked(validateTeacherLevel).mockResolvedValue(ok(undefined));
    vi.mocked(TenantContext.getClient).mockReturnValue(makeTenantClient() as any);
  });

  it('rename only — does NOT call materiaRepo, validateTeacherLevel or docenteService; returns ok(grupo)', async () => {
    const grupo = makeGrupo();
    const grupoRepo = makeGrupoRepo(grupo);
    const materiaRepo = makeMateriaRepo(makeMateria());
    const dxc = makeDocenteXCiclo();
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);
    const result = await uc.execute({ id: 'g-1', name: 'Grupo Nuevo' });

    expect(grupoRepo.update).toHaveBeenCalledWith('g-1', { name: 'Grupo Nuevo', docenteXCicloId: undefined });
    expect(materiaRepo.findById).not.toHaveBeenCalled();
    expect(validateTeacherLevel).not.toHaveBeenCalled();
    expect(result.isOk()).toBe(true);
  });

  it('reassign teacher — calls materiaRepo, validateTeacherLevel, docenteService, grupoRepo.update; returns ok(grupo)', async () => {
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
    const result = await uc.execute({ id: 'g-1', userId: 'user-2' });

    expect(materiaRepo.findById).toHaveBeenCalledWith('m-1');
    expect(validateTeacherLevel).toHaveBeenCalledWith(prisma, 'user-2', 'cc-uuid-1');
    expect(docenteService.getOrCreateForCycle).toHaveBeenCalledWith('user-2', 'cycle-1');
    expect(grupoRepo.update).toHaveBeenCalledWith('g-1', {
      name: undefined,
      docenteXCicloId: 'dxc-new',
    });
    expect(result.isOk()).toBe(true);
  });

  it('returns err(NotFoundError) when grupo does not exist', async () => {
    const grupoRepo = makeGrupoRepo(null);
    const materiaRepo = makeMateriaRepo(null);
    const docenteRepo = makeDocenteRepo(makeDocenteXCiclo());
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);
    const result = await uc.execute({ id: 'non-existent', name: 'X' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(grupoRepo.update).not.toHaveBeenCalled();
  });

  it('propagates err(ValidationError) when validateTeacherLevel returns err', async () => {
    vi.mocked(validateTeacherLevel).mockResolvedValueOnce(
      err(new ValidationError('La materia no pertenece al nivel del docente')),
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
    const result = await uc.execute({ id: 'g-1', userId: 'user-bad' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(grupoRepo.update).not.toHaveBeenCalled();
  });

  it('infra guard — still throws (NOT Result) when TenantContext.getClient() returns null (MGCM-R6)', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);

    const grupo = makeGrupo();
    const materia = makeMateria();
    const grupoRepo = makeGrupoRepo(grupo);
    const materiaRepo = makeMateriaRepo(materia);
    const dxc = makeDocenteXCiclo();
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);
    const prisma = makePrismaService();

    const uc = new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma as any);

    await expect(uc.execute({ id: 'g-1', userId: 'user-2' })).rejects.toThrow(
      'No tenant client available',
    );
  });
});
