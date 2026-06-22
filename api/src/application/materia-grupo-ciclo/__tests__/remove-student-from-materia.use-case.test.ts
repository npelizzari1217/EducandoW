/**
 * RemoveStudentFromMateriaUseCase — unit tests (TDD, T2.3)
 * Spec: MGC-R9, MGC-S19, MGC-S22 · Design: D4
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoveStudentFromMateriaUseCase } from '../remove-student-from-materia.use-case';
import type { MateriaXCursoXCicloRepository, AlumnosXMateriaRepository } from '@educandow/domain';
import { MateriaXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeMateria(id = 'mxcc-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    subjectId: 'sub-1',
    esOptativa: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMateriaRepo(materia: MateriaXCursoXCiclo | null): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn().mockResolvedValue([]),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn(),
    setEsOptativa: vi.fn(),
  };
}

function makeAlumnosRepo(): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue({ count: 0 }),
    findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    removeStudent: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('RemoveStudentFromMateriaUseCase', () => {
  it('happy path: delegates alumnosRepo.removeStudent(alumnoXMateriaId)', async () => {
    const materia = makeMateria('mxcc-1');
    const materiaRepo = makeMateriaRepo(materia);
    const alumnosRepo = makeAlumnosRepo();
    const uc = new RemoveStudentFromMateriaUseCase(materiaRepo, alumnosRepo);

    await uc.execute({ materiaXCursoXCicloId: 'mxcc-1', alumnoXMateriaId: 'axm-42' });

    expect(materiaRepo.findById).toHaveBeenCalledWith('mxcc-1');
    expect(alumnosRepo.removeStudent).toHaveBeenCalledWith('axm-42');
    expect(alumnosRepo.removeStudent).toHaveBeenCalledTimes(1);
  });

  it('materia not found → throws NotFoundError', async () => {
    const materiaRepo = makeMateriaRepo(null);
    const alumnosRepo = makeAlumnosRepo();
    const uc = new RemoveStudentFromMateriaUseCase(materiaRepo, alumnosRepo);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent', alumnoXMateriaId: 'axm-42' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does NOT call alumnosRepo.removeStudent when materia not found', async () => {
    const materiaRepo = makeMateriaRepo(null);
    const alumnosRepo = makeAlumnosRepo();
    const uc = new RemoveStudentFromMateriaUseCase(materiaRepo, alumnosRepo);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent', alumnoXMateriaId: 'axm-42' }),
    ).rejects.toThrow();

    expect(alumnosRepo.removeStudent).not.toHaveBeenCalled();
  });
});
