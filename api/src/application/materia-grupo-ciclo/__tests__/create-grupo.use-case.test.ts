/**
 * CreateGrupoUseCase — unit tests (TDD, Fase 3c)
 * Covers: F3-T7 (MGC-S7), F3-T8 (MGC-S8 split subject)
 */
import { describe, it, expect, vi } from 'vitest';
import { CreateGrupoUseCase } from '../create-grupo.use-case';
import type {
  MateriaXCursoXCicloRepository,
  GrupoRepository,
} from '@educandow/domain';
import {
  MateriaXCursoXCiclo,
  GrupoXCursoXMateriaXCiclo,
  NotFoundError,
  DocenteXCiclo,
} from '@educandow/domain';
import { DocenteXCicloService } from '../../docente-ciclo/docente-x-ciclo.service';
import type { DocenteXCicloRepository } from '@educandow/domain';

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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CreateGrupoUseCase', () => {
  // F3-T7 / MGC-S7: normal subject — create 1 group
  it('creates a group for a materia with a docente (MGC-S7)', async () => {
    const materia = makeMateria();
    const dxc = makeDocenteXCiclo('dxc-1');
    const grupo = makeGrupo();

    const materiaRepo = makeMateriaRepo(materia);
    const grupoRepo = makeGrupoRepo(grupo);
    const docenteRepo = makeDocenteRepo(dxc);
    const docenteService = new DocenteXCicloService(docenteRepo);

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService);

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

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService);

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

    const uc = new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent', userId: 'user-1', cycleId: 'cycle-1' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
