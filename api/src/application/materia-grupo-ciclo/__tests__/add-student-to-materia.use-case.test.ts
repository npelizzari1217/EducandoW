/**
 * AddStudentToMateriaUseCase — unit tests (TDD, Fase 3c)
 * Covers: F3-T3 (MGC-S9), F3-T5 (MGC-S10 via wrong materia), MGC-S5 (ingresante rejected)
 */
import { describe, it, expect, vi } from 'vitest';
import { AddStudentToMateriaUseCase } from '../add-student-to-materia.use-case';
import type { MateriaXCursoXCicloRepository, AlumnosXMateriaRepository, StudentRepository } from '@educandow/domain';
import { MateriaXCursoXCiclo, MateriasXAlumnoXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMateria(id = 'm-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    subjectId: 'subj-1',
    esOptativa: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAlumnosXMateria(): MateriasXAlumnoXCursoXCiclo {
  return MateriasXAlumnoXCursoXCiclo.reconstruct({
    id: 'axm-1',
    materiaXCursoXCicloId: 'm-1',
    studentId: 's-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeStudent() {
  return { id: 's-1', firstName: 'Juan', lastName: 'Pérez' };
}

function makeMateriaRepo(materia: MateriaXCursoXCiclo | null): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn().mockResolvedValue(materia ? [materia] : []),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn().mockResolvedValue(materia ?? makeMateria()),
    setEsOptativa: vi.fn(),
  };
}

function makeAlumnosRepo(): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn().mockResolvedValue(makeAlumnosXMateria()),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    removeStudent: vi.fn().mockResolvedValue(undefined),
  };
}

function makeStudentRepo(student: ReturnType<typeof makeStudent> | null): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(student),
    findByInstitution: vi.fn(),
    findByDni: vi.fn(),
    search: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByUserId: vi.fn(),
    findByGuardianUserId: vi.fn(),
  } as unknown as StudentRepository;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AddStudentToMateriaUseCase', () => {
  // F3-T3 / MGC-S9: enrolled student can be added to materia
  it('adds enrolled student to materia universe (MGC-S9)', async () => {
    const materia = makeMateria();
    const student = makeStudent();
    const materiaRepo = makeMateriaRepo(materia);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(student);
    const uc = new AddStudentToMateriaUseCase(materiaRepo, alumnosRepo, studentRepo);

    const result = await uc.execute({ materiaXCursoXCicloId: 'm-1', studentId: 's-1' });

    expect(alumnosRepo.addStudent).toHaveBeenCalledWith('m-1', 's-1');
    expect(result).toBeDefined();
  });

  // MGC-S5: ingresante / student not in registry → rejected
  it('rejects student not in the enrolled registry (MGC-S5)', async () => {
    const materia = makeMateria();
    const materiaRepo = makeMateriaRepo(materia);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(null); // student not found
    const uc = new AddStudentToMateriaUseCase(materiaRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'm-1', studentId: 'unknown-student' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.addStudent).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when materia does not exist', async () => {
    const materiaRepo = makeMateriaRepo(null);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(makeStudent());
    const uc = new AddStudentToMateriaUseCase(materiaRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ materiaXCursoXCicloId: 'non-existent', studentId: 's-1' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
