/**
 * ListGruposUseCase — unit tests (TDD, Fase 3c)
 */
import { describe, it, expect, vi } from 'vitest';
import { ListGruposUseCase } from '../list-grupos.use-case';
import type { GrupoRepository, AlumnosXGrupoRepository } from '@educandow/domain';
import { GrupoXCursoXMateriaXCiclo, AlumnosXGrupoXCursoXMateriaXCiclo } from '@educandow/domain';

function makeGrupo(id: string, materiaId: string, dxcId: string): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId: dxcId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAxg(id: string, grupoId: string, axmId: string): AlumnosXGrupoXCursoXMateriaXCiclo {
  return AlumnosXGrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    grupoId,
    alumnosXMateriaXCursoXCicloId: axmId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ListGruposUseCase', () => {
  it('returns grupos with their alumnos', async () => {
    const grupos = [
      makeGrupo('g-1', 'm-1', 'dxc-1'),
      makeGrupo('g-2', 'm-1', 'dxc-2'),
    ];

    const grupoRepo: GrupoRepository = {
      findById: vi.fn(),
      findByMateria: vi.fn().mockResolvedValue(grupos),
      findByDocente: vi.fn(),
      findGroupsForDocente: vi.fn(),
      create: vi.fn(),
      findAllGlobal: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const alumnosGrupoRepo: AlumnosXGrupoRepository = {
      findByGrupo: vi.fn()
        .mockResolvedValueOnce([makeAxg('axg-1', 'g-1', 'axm-1'), makeAxg('axg-2', 'g-1', 'axm-2')]) // g-1: 2 alumnos
        .mockResolvedValueOnce([makeAxg('axg-3', 'g-2', 'axm-3')]),                                    // g-2: 1 alumno
      addStudent: vi.fn(),
      isMember: vi.fn(),
      upsertMany: vi.fn(),
    };

    const uc = new ListGruposUseCase(grupoRepo, alumnosGrupoRepo);
    const result = await uc.execute('m-1');

    expect(result).toHaveLength(2);
    expect(result[0].grupo.id).toBe('g-1');
    expect(result[0].alumnos).toHaveLength(2);
    expect(result[1].grupo.id).toBe('g-2');
    expect(result[1].alumnos).toHaveLength(1);
  });

  it('returns empty array when no grupos exist', async () => {
    const grupoRepo: GrupoRepository = {
      findById: vi.fn(),
      findByMateria: vi.fn().mockResolvedValue([]),
      findByDocente: vi.fn(),
      findGroupsForDocente: vi.fn(),
      create: vi.fn(),
      findAllGlobal: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const alumnosGrupoRepo: AlumnosXGrupoRepository = {
      findByGrupo: vi.fn(),
      addStudent: vi.fn(),
      isMember: vi.fn(),
      upsertMany: vi.fn(),
    };

    const uc = new ListGruposUseCase(grupoRepo, alumnosGrupoRepo);
    const result = await uc.execute('m-empty');

    expect(result).toHaveLength(0);
  });
});
