/**
 * RemoveStudentFromGrupoUseCase — unit tests (TDD)
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoveStudentFromGrupoUseCase } from '../remove-student-from-grupo.use-case';
import type { GrupoRepository, AlumnosXGrupoRepository } from '@educandow/domain';
import { GrupoXCursoXMateriaXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGrupo(id = 'grupo-1'): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: 'm-1',
    docenteXCicloId: 'dxc-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupoRepo(grupo: GrupoXCursoXMateriaXCiclo | null): GrupoRepository {
  return {
    findById: vi.fn().mockResolvedValue(grupo),
    findByMateria: vi.fn().mockResolvedValue([]),
    findByDocente: vi.fn().mockResolvedValue([]),
    findGroupsForDocente: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(grupo),
    findAllGlobal: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function makeAlumnosGrupoRepo(): AlumnosXGrupoRepository {
  return {
    findByGrupo: vi.fn().mockResolvedValue([]),
    findByGrupoEnriched: vi.fn().mockResolvedValue([]),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    removeStudent: vi.fn().mockResolvedValue(undefined), // (grupoId, id)
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('RemoveStudentFromGrupoUseCase', () => {
  it('happy path: llama removeStudent con (grupoId, alumnoXGrupoId)', async () => {
    const grupo = makeGrupo('grupo-1');
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const uc = new RemoveStudentFromGrupoUseCase(grupoRepo, alumnosGrupoRepo);

    await uc.execute({ grupoId: 'grupo-1', alumnoXGrupoId: 'axg-42' });

    // FIX 1: grupoId debe pasarse primero para enforcer scope (previene IDOR)
    expect(alumnosGrupoRepo.removeStudent).toHaveBeenCalledWith('grupo-1', 'axg-42');
    expect(alumnosGrupoRepo.removeStudent).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError cuando el grupo no existe', async () => {
    const grupoRepo = makeGrupoRepo(null);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const uc = new RemoveStudentFromGrupoUseCase(grupoRepo, alumnosGrupoRepo);

    await expect(
      uc.execute({ grupoId: 'non-existent', alumnoXGrupoId: 'axg-42' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosGrupoRepo.removeStudent).not.toHaveBeenCalled();
  });

  it('IDOR prevention: alumnoXGrupoId de otro grupo → removeStudent se llama con grupoId correcto (el deleteMany no matchea → no-op)', async () => {
    // El UC siempre pasa grupoId al repo. El repo usa deleteMany({where:{id, grupoId}}).
    // Si axg-99 pertenece a grupo-2, la condición {id:'axg-99', grupoId:'grupo-1'}
    // no matchea ningún registro → count=0, no-op nativo, sin error.
    const grupo = makeGrupo('grupo-1');
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const uc = new RemoveStudentFromGrupoUseCase(grupoRepo, alumnosGrupoRepo);

    // axg-99 no pertenece a grupo-1 pero el caller pasa grupoId='grupo-1'
    await uc.execute({ grupoId: 'grupo-1', alumnoXGrupoId: 'axg-99' });

    // El UC siempre delega con (grupoId, alumnoXGrupoId) — el scope se enforza en el repo
    expect(alumnosGrupoRepo.removeStudent).toHaveBeenCalledWith('grupo-1', 'axg-99');
    expect(alumnosGrupoRepo.removeStudent).toHaveBeenCalledTimes(1);
  });
});
