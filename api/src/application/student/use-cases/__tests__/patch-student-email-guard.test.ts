/**
 * Fix 8 — pass-through guard for fatherEmail / motherEmail on PATCH.
 *
 * Before the fix: re-sending the stored fatherEmail/motherEmail always calls resolveEmail
 * → Email.create → throws if the stored value fails current validation rules.
 * After the fix: identical value short-circuits validation (pass-through), matching the
 * guard already in place for student.email (student.use-cases.ts ~line 230).
 */
import { describe, it, expect, vi } from 'vitest';
import { PatchStudentUseCase } from '../student.use-cases';
import {
  Student,
  StudentRepository,
  StudentGuardianRepository,
  Email,
  Dni,
  Id,
} from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<{
  fatherEmail: Email;
  motherEmail: Email;
}> = {}): Student {
  return Student.reconstruct({
    id: Id.create('student-1'),
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: Dni.reconstruct('12345678'),
    ...overrides,
  });
}

function makeStudentRepo(student: Student): StudentRepository {
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

function makeGuardianRepo(): StudentGuardianRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByStudentId: vi.fn().mockResolvedValue([]),
    findByGuardianUserId: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    findByComposite: vi.fn().mockResolvedValue(null),
    findStudyTutor: vi.fn().mockResolvedValue(null),
  };
}

const adminCaller = { userId: 'admin-1', roles: ['ROOT'] };

// 'not@valid-email' has no TLD dot → fails Email.create regex but can be stored via reconstruct
const LEGACY_INVALID = 'not@valid-email';

// ── Fix 8 tests ────────────────────────────────────────────────────────────────

describe('PatchStudentUseCase — fatherEmail / motherEmail pass-through guard (Fix 8)', () => {
  // RED before the fix: resolveEmail calls Email.create('not@valid-email') → throws
  it('re-sending stored fatherEmail (legacy invalid format) does not throw — pass-through', async () => {
    const fatherEmail = Email.reconstruct(LEGACY_INVALID);
    const student = makeStudent({ fatherEmail });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    await expect(
      uc.execute(student.id.get(), { fatherEmail: LEGACY_INVALID }, adminCaller),
    ).resolves.toSatisfy(r => r.isOk() === true);
  });

  // RED before the fix: same reason
  it('re-sending stored motherEmail (legacy invalid format) does not throw — pass-through', async () => {
    const motherEmail = Email.reconstruct(LEGACY_INVALID);
    const student = makeStudent({ motherEmail });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    await expect(
      uc.execute(student.id.get(), { motherEmail: LEGACY_INVALID }, adminCaller),
    ).resolves.toSatisfy(r => r.isOk() === true);
  });

  // These are already GREEN (pre-existing behavior must stay intact)
  it("empty string fatherEmail ('') clears the field to undefined", async () => {
    const student = makeStudent({ fatherEmail: Email.reconstruct('papa@test.com') });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    const result = await uc.execute(student.id.get(), { fatherEmail: '' }, adminCaller);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().fatherEmail).toBeUndefined();
  });

  it("empty string motherEmail ('') clears the field to undefined", async () => {
    const student = makeStudent({ motherEmail: Email.reconstruct('mama@test.com') });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    const result = await uc.execute(student.id.get(), { motherEmail: '' }, adminCaller);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().motherEmail).toBeUndefined();
  });

  it('a genuinely changed fatherEmail is validated and stored', async () => {
    const student = makeStudent({ fatherEmail: Email.reconstruct('old@test.com') });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    const result = await uc.execute(student.id.get(), { fatherEmail: 'new@test.com' }, adminCaller);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().fatherEmail?.get()).toBe('new@test.com');
  });

  it('a genuinely changed motherEmail is validated and stored', async () => {
    const student = makeStudent({ motherEmail: Email.reconstruct('old@test.com') });
    const uc = new PatchStudentUseCase(makeStudentRepo(student), makeGuardianRepo());

    const result = await uc.execute(student.id.get(), { motherEmail: 'new@test.com' }, adminCaller);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().motherEmail?.get()).toBe('new@test.com');
  });
});
