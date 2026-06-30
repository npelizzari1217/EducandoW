/**
 * Phase 4 — TASK-10 (RED)
 * Error-path unit tests for PatchStudentUseCase.
 * All 5 scenarios must FAIL until TASK-12+13 (GREEN) migrate execute() to Result.
 */
import { describe, it, expect, vi } from 'vitest';
import { PatchStudentUseCase } from '../student.use-cases';
import {
  Student,
  StudentRepository,
  StudentGuardianRepository,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  Dni,
  Id,
} from '@educandow/domain';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeStudent(userId = 'user-1'): Student {
  return Student.reconstruct({
    id: Id.create('student-1'),
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: Dni.reconstruct('12345678'),
    userId,
  });
}

function makeStudentRepo(student: Student | null): StudentRepository {
  return {
    findById: vi.fn().mockResolvedValue(student),
    save: vi.fn().mockResolvedValue(undefined),
    findByInstitution: vi.fn().mockResolvedValue([]),
    findByDni: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    findByUserId: vi.fn().mockResolvedValue(null),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    setFechaDePase: vi.fn().mockResolvedValue(undefined),
  };
}

function makeGuardianRepo(linkedStudentId: string | null = null): StudentGuardianRepository {
  // Returns a guardian linking tutor to linkedStudentId, or empty if null
  const guardians = linkedStudentId ? [{ studentId: linkedStudentId }] : [];
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByStudentId: vi.fn().mockResolvedValue([]),
    findByGuardianUserId: vi.fn().mockResolvedValue(guardians),
    delete: vi.fn().mockResolvedValue(undefined),
    findByComposite: vi.fn().mockResolvedValue(null),
    findStudyTutor: vi.fn().mockResolvedValue(null),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PatchStudentUseCase — error paths (Phase 4 TDD)', () => {
  it('Test A: student not found → err(NotFoundError)', async () => {
    const uc = new PatchStudentUseCase(makeStudentRepo(null), makeGuardianRepo());
    const result = await uc.execute('nonexistent-id', {}, { userId: 'admin-1', roles: ['ADMIN'] });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('Test B: STUDENT caller editing another student → err(ForbiddenError)', async () => {
    const student = makeStudent('user-1');
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());
    const result = await uc.execute(
      student.id.get(),
      {},
      { userId: 'other-user', roles: ['STUDENT'] },
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('Test C: TUTOR not linked to the target student → err(ForbiddenError)', async () => {
    const student = makeStudent('user-1');
    // Guardian repo returns no linked students for tutor-1
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo(null));
    const result = await uc.execute(
      student.id.get(),
      {},
      { userId: 'tutor-1', roles: ['TUTOR'] },
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('Test D: restricted caller patching a forbidden field → err(ForbiddenError)', async () => {
    // STUDENT owns the student (userId matches) but tries to patch 'lastName'
    // which is NOT in ALLOWED_TUTOR_FIELDS → ForbiddenError
    const student = makeStudent('user-1');
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());
    const result = await uc.execute(
      student.id.get(),
      { lastName: 'NuevoApellido' },
      { userId: 'user-1', roles: ['STUDENT'] },
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('Test E: ADMIN caller with invalid fatherEmail → err(ValidationError)', async () => {
    // ADMIN is in FULL_ACCESS_ROLES → no ownership/field restrictions
    // but invalid email format fails Email.create → ValidationError
    const student = makeStudent('user-1');
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());
    const result = await uc.execute(
      student.id.get(),
      { fatherEmail: 'not-a-valid-email' },
      { userId: 'admin-1', roles: ['ADMIN'] },
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });
});
