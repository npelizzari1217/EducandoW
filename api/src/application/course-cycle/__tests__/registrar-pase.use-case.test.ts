/**
 * RegistrarPaseUseCase — unit tests (TDD RED, PR2 task 2.1, pase-alumno-egreso)
 *
 * Covers:
 * - S-2-A: happy path — registrar pase
 * - S-2-B: revert — fechaDePase null
 * - S-2-C: NotFound when cc does not exist
 * - S-3-D: NotFound / IDOR when enrollment does not belong to cc
 * - S-4-A: NotFound when student does not exist
 * - S-4-B: fecha futura → PaseFechaInvalidaError propagated
 *
 * Tests are RED until task 2.4 implements RegistrarPaseUseCase.
 */
import { describe, it, expect, vi } from 'vitest';
import { RegistrarPaseUseCase } from '../registrar-pase.use-case';
import type {
  CourseCycleRepository,
  AlumnosXCursoXCicloRepository,
  StudentRepository,
} from '@educandow/domain';
import {
  AlumnosXCursoXCiclo,
  NotFoundError,
  PaseFechaInvalidaError,
  Student,
  Dni,
  Id,
} from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

const VALID_DATE = new Date('2026-06-01T00:00:00.000Z');
const FUTURE_DATE = new Date('2099-01-01T00:00:00.000Z');

function makeEnrollment(id = 'axcc-1', courseCycleId = 'cc-1', studentId = 's-1'): AlumnosXCursoXCiclo {
  return AlumnosXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    studentId,
    printable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeStudent(tienePase = false): Student {
  return Student.reconstruct({
    id: Id.reconstruct('s-1'),
    firstName: 'Ana',
    lastName: 'García',
    dni: Dni.reconstruct('12345678'),
    fechaDePase: tienePase ? VALID_DATE : undefined,
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
    isMember: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn(),
    setPrintableBulk: vi.fn(),
    findByStudentEnriched: vi.fn().mockResolvedValue([]),
  } as unknown as AlumnosXCursoXCicloRepository;
}

function makeStudentRepo(student: Student | null): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(student),
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

describe('RegistrarPaseUseCase', () => {
  it('S-2-A: happy path — registra pase y llama setFechaDePase con (studentId, fecha)', async () => {
    const enrollment = makeEnrollment('axcc-1', 'cc-1', 's-1');
    const student = makeStudent(false);
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const studentRepo = makeStudentRepo(student);

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);
    await uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', fechaDePase: VALID_DATE });

    expect(studentRepo.setFechaDePase).toHaveBeenCalledWith('s-1', VALID_DATE);
    expect(studentRepo.setFechaDePase).toHaveBeenCalledTimes(1);
  });

  it('S-2-B: revert — fechaDePase null llama setFechaDePase con (studentId, null)', async () => {
    const enrollment = makeEnrollment('axcc-1', 'cc-1', 's-1');
    const student = makeStudent(true);
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const studentRepo = makeStudentRepo(student);

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);
    await uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', fechaDePase: null });

    expect(studentRepo.setFechaDePase).toHaveBeenCalledWith('s-1', null);
  });

  it('S-2-C: lanza NotFoundError cuando el CourseCycle no existe', async () => {
    const ccRepo = makeCCRepo(false);
    const alumnosRepo = makeAlumnosRepo(null);
    const studentRepo = makeStudentRepo(null);

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-999', id: 'axcc-1', fechaDePase: VALID_DATE }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(alumnosRepo.findById).not.toHaveBeenCalled();
    expect(studentRepo.setFechaDePase).not.toHaveBeenCalled();
  });

  it('S-3-D (IDOR): lanza NotFoundError cuando el enrollment pertenece a otro cc', async () => {
    // enrollment belongs to cc-2, caller claims cc-1
    const enrollment = makeEnrollment('axcc-1', 'cc-2', 's-1');
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const studentRepo = makeStudentRepo(makeStudent());

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', fechaDePase: VALID_DATE }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(studentRepo.setFechaDePase).not.toHaveBeenCalled();
  });

  it('S-3-D: lanza NotFoundError cuando el enrollment no existe', async () => {
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(null);
    const studentRepo = makeStudentRepo(makeStudent());

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-nonexistent', fechaDePase: VALID_DATE }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(studentRepo.setFechaDePase).not.toHaveBeenCalled();
  });

  it('S-4-A: lanza NotFoundError cuando el Student no existe', async () => {
    const enrollment = makeEnrollment('axcc-1', 'cc-1', 's-1');
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const studentRepo = makeStudentRepo(null);

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', fechaDePase: VALID_DATE }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(studentRepo.setFechaDePase).not.toHaveBeenCalled();
  });

  it('S-4-B: propaga PaseFechaInvalidaError cuando la fecha es futura', async () => {
    const enrollment = makeEnrollment('axcc-1', 'cc-1', 's-1');
    const student = makeStudent(false);
    const ccRepo = makeCCRepo(true);
    const alumnosRepo = makeAlumnosRepo(enrollment);
    const studentRepo = makeStudentRepo(student);

    const uc = new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', fechaDePase: FUTURE_DATE }),
    ).rejects.toBeInstanceOf(PaseFechaInvalidaError);

    expect(studentRepo.setFechaDePase).not.toHaveBeenCalled();
  });
});
