/**
 * RemoveStudentFromCourseCycleUseCase — unit tests (TDD, T-11, SDD-1)
 * Covers: S-05 (happy path), S-08 (not found → NotFoundError)
 *
 * Input is the bridge-row ID (ADR #1243 — overrides spec R-7 which said studentId).
 * No real DB — repos are mocked via vi.fn().
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoveStudentFromCourseCycleUseCase } from '../remove-student-from-course-cycle.use-case';
import type {
  CourseCycleRepository,
  AlumnosXCursoXCicloRepository,
} from '@educandow/domain';
import { AlumnosXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEnrollment(id = 'axcc-1', courseCycleId = 'cc-1'): AlumnosXCursoXCiclo {
  return AlumnosXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
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

function makeAlumnosRepo(enrollment: AlumnosXCursoXCiclo | null): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(enrollment),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(enrollment !== null),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(enrollment),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('RemoveStudentFromCourseCycleUseCase', () => {
  it('S-05: happy path — calls repo.remove with (courseCycleId, id)', async () => {
    const enrollment = makeEnrollment('axcc-1', 'cc-1');
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const uc = new RemoveStudentFromCourseCycleUseCase(ccRepo, alumnosRepo);

    await uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1' });

    expect(alumnosRepo.remove).toHaveBeenCalledWith('cc-1', 'axcc-1');
    expect(alumnosRepo.remove).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when course-cycle does not exist', async () => {
    const ccRepo = makeCCRepo(false);
    const alumnosRepo = makeAlumnosRepo(null);
    const uc = new RemoveStudentFromCourseCycleUseCase(ccRepo, alumnosRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-999', id: 'axcc-1' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.findById).not.toHaveBeenCalled();
    expect(alumnosRepo.remove).not.toHaveBeenCalled();
  });

  it('S-08: throws NotFoundError when enrollment row does not exist', async () => {
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(null); // findById returns null
    const uc = new RemoveStudentFromCourseCycleUseCase(ccRepo, alumnosRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-nonexistent' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.remove).not.toHaveBeenCalled();
  });

  it('S-08 (IDOR): throws NotFoundError when enrollment belongs to a different course-cycle', async () => {
    // Enrollment exists but belongs to cc-2, not cc-1
    const enrollment = makeEnrollment('axcc-1', 'cc-2');
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const uc = new RemoveStudentFromCourseCycleUseCase(ccRepo, alumnosRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1' })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.remove).not.toHaveBeenCalled();
  });
});
