/**
 * ListMateriasUseCase — unit tests (TDD, Fase 3c)
 */
import { describe, it, expect, vi } from 'vitest';
import { ListMateriasUseCase } from '../list-materias.use-case';
import type { MateriaXCursoXCicloRepository, AlumnosXMateriaRepository, GrupoRepository } from '@educandow/domain';
import { MateriaXCursoXCiclo, MateriasXAlumnoXCursoXCiclo, GrupoXCursoXMateriaXCiclo } from '@educandow/domain';

function makeMateria(id: string, subjectId: string): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    subjectId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAxm(id: string, materiaId: string): MateriasXAlumnoXCursoXCiclo {
  return MateriasXAlumnoXCursoXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    studentId: `student-${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupo(id: string, materiaId: string): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId: 'dxc-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ListMateriasUseCase', () => {
  it('returns materias with alumno and grupo counts', async () => {
    const materias = [makeMateria('m-1', 'subj-1'), makeMateria('m-2', 'subj-2')];

    const materiaRepo: MateriaXCursoXCicloRepository = {
      findById: vi.fn(),
      findByCourseCycleId: vi.fn().mockResolvedValue(materias),
      upsertMany: vi.fn(),
      updateDescription: vi.fn(),
    };

    const alumnosRepo: AlumnosXMateriaRepository = {
      findByMateria: vi.fn()
        .mockResolvedValueOnce([makeAxm('axm-1', 'm-1'), makeAxm('axm-2', 'm-1')]) // m-1 has 2 alumnos
        .mockResolvedValueOnce([makeAxm('axm-3', 'm-2')]),                           // m-2 has 1 alumno
      findById: vi.fn(),
      addStudent: vi.fn(),
      isMember: vi.fn(),
      upsertMany: vi.fn(),
      findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    };

    const grupoRepo: GrupoRepository = {
      findById: vi.fn(),
      findByMateria: vi.fn()
        .mockResolvedValueOnce([makeGrupo('g-1', 'm-1')]) // m-1 has 1 grupo
        .mockResolvedValueOnce([]),                         // m-2 has 0 grupos
      findByDocente: vi.fn(),
      findGroupsForDocente: vi.fn(),
      create: vi.fn(),
      findAllGlobal: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const uc = new ListMateriasUseCase(materiaRepo, alumnosRepo, grupoRepo);
    const result = await uc.execute('cc-1');

    expect(result).toHaveLength(2);
    expect(result[0].materia.id).toBe('m-1');
    expect(result[0].alumnoCount).toBe(2);
    expect(result[0].grupoCount).toBe(1);
    expect(result[1].materia.id).toBe('m-2');
    expect(result[1].alumnoCount).toBe(1);
    expect(result[1].grupoCount).toBe(0);
  });

  it('returns empty array when no materias exist', async () => {
    const materiaRepo: MateriaXCursoXCicloRepository = {
      findById: vi.fn(),
      findByCourseCycleId: vi.fn().mockResolvedValue([]),
      upsertMany: vi.fn(),
      updateDescription: vi.fn(),
    };
    const alumnosRepo: AlumnosXMateriaRepository = {
      findByMateria: vi.fn(),
      findById: vi.fn(),
      addStudent: vi.fn(),
      isMember: vi.fn(),
      upsertMany: vi.fn(),
      findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    };
    const grupoRepo: GrupoRepository = {
      findById: vi.fn(),
      findByMateria: vi.fn(),
      findByDocente: vi.fn(),
      findGroupsForDocente: vi.fn(),
      create: vi.fn(),
      findAllGlobal: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const uc = new ListMateriasUseCase(materiaRepo, alumnosRepo, grupoRepo);
    const result = await uc.execute('cc-empty');

    expect(result).toHaveLength(0);
  });
});
