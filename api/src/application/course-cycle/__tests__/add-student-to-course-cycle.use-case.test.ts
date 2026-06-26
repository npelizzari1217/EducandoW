/**
 * AddStudentToCourseCycleUseCase — unit tests (TDD, T-07, SDD-1)
 * Covers: S-01 (happy path), S-02 (idempotent re-add), S-06 (student not found),
 *         S-07 (course-cycle not found)
 *
 * No real DB — all repos are mocked via vi.fn().
 */
import { describe, it, expect, vi } from 'vitest';
import { AddStudentToCourseCycleUseCase } from '../add-student-to-course-cycle.use-case';
import type {
  CourseCycleRepository,
  AlumnosXCursoXCicloRepository,
  StudentRepository,
} from '@educandow/domain';
import { AlumnosXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEnrollment(id = 'axcc-1'): AlumnosXCursoXCiclo {
  return AlumnosXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    studentId: 's-1',
    printable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCCRepo(found: boolean): CourseCycleRepository {
  return {
    findByUuid: vi.fn().mockResolvedValue(found ? { uuid: 'cc-1' } : null),
    findById: vi.fn(),
    findByPair: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    createMany: vi.fn(),
    softDelete: vi.fn(),
    findGradingContextByUuid: vi.fn(),
    findGradingContextsByUuids: vi.fn(),
    findEnrolledStudents: vi.fn(),
    findByCourseSectionIds: vi.fn(),
    findByUuids: vi.fn(),
  } as unknown as CourseCycleRepository;
}

function makeAlumnosRepo(existing: AlumnosXCursoXCiclo | null = null): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(existing),
    addStudent: vi.fn().mockResolvedValue(existing ?? makeEnrollment()),
    isMember: vi.fn().mockResolvedValue(existing !== null),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(existing),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
    findByStudentEnriched: vi.fn().mockResolvedValue([]),
  };
}

function makeStudentRepo(found: boolean): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(found ? { id: 's-1', firstName: 'Ana', lastName: 'García' } : null),
    findByInstitution: vi.fn(),
    findByDni: vi.fn(),
    search: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByUserId: vi.fn(),
    findByGuardianUserId: vi.fn(),
    setFechaDePase: vi.fn().mockResolvedValue(undefined),
  } as unknown as StudentRepository;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AddStudentToCourseCycleUseCase', () => {
  it('S-01: adds student to course-cycle and returns the enrollment entity', async () => {
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(true);
    const uc = new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo);

    const result = await uc.execute({ courseCycleId: 'cc-1', studentId: 's-1' });

    expect(alumnosRepo.addStudent).toHaveBeenCalledWith('cc-1', 's-1');
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(AlumnosXCursoXCiclo);
  });

  it('S-02: idempotent — re-adding existing student returns existing enrollment, no error', async () => {
    const existing = makeEnrollment('axcc-existing');
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(existing);
    const studentRepo = makeStudentRepo(true);
    const uc = new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo);

    // First call
    const first = await uc.execute({ courseCycleId: 'cc-1', studentId: 's-1' });
    // Second call (simulates re-add)
    const second = await uc.execute({ courseCycleId: 'cc-1', studentId: 's-1' });

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // addStudent is called both times — idempotency is enforced by the repo (upsert)
    expect(alumnosRepo.addStudent).toHaveBeenCalledTimes(2);
  });

  it('S-07: throws NotFoundError when course-cycle does not exist', async () => {
    const ccRepo = makeCCRepo(false);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(true);
    const uc = new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-999', studentId: 's-1' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.addStudent).not.toHaveBeenCalled();
  });

  it('S-06: throws NotFoundError when student does not exist', async () => {
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(false);
    const uc = new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', studentId: 's-999' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.addStudent).not.toHaveBeenCalled();
  });

  it('validates course-cycle before student — course-cycle check runs first', async () => {
    // Both missing; should throw NotFoundError for CourseCycle (checked first)
    const ccRepo = makeCCRepo(false);
    const alumnosRepo = makeAlumnosRepo();
    const studentRepo = makeStudentRepo(false);
    const uc = new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo);

    const error = await uc.execute({ courseCycleId: 'cc-999', studentId: 's-999' }).catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toContain('CourseCycle');
    expect(studentRepo.findById).not.toHaveBeenCalled();
  });
});
