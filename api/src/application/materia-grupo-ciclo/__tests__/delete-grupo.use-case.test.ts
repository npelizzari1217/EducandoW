/**
 * DeleteGrupoUseCase — unit tests (TDD)
 * Covers: success path, not found.
 */
import { describe, it, expect, vi } from 'vitest';
import { DeleteGrupoUseCase } from '../delete-grupo.use-case';
import type { GrupoRepository } from '@educandow/domain';
import { GrupoXCursoXMateriaXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGrupo(id = 'g-1'): GrupoXCursoXMateriaXCiclo {
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
    findByMateria: vi.fn(),
    findByDocente: vi.fn(),
    findGroupsForDocente: vi.fn(),
    create: vi.fn(),
    findAllGlobal: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('DeleteGrupoUseCase', () => {
  it('calls repo.delete when grupo exists', async () => {
    const grupo = makeGrupo('g-1');
    const grupoRepo = makeGrupoRepo(grupo);

    const uc = new DeleteGrupoUseCase(grupoRepo);
    await uc.execute('g-1');

    expect(grupoRepo.findById).toHaveBeenCalledWith('g-1');
    expect(grupoRepo.delete).toHaveBeenCalledWith('g-1');
  });

  it('throws NotFoundError when grupo does not exist', async () => {
    const grupoRepo = makeGrupoRepo(null);

    const uc = new DeleteGrupoUseCase(grupoRepo);

    await expect(uc.execute('non-existent')).rejects.toBeInstanceOf(NotFoundError);
    expect(grupoRepo.delete).not.toHaveBeenCalled();
  });
});
