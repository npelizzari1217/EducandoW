import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatchStudentUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository, StudentGuardianRepository, Student, ForbiddenError, NotFoundError } from '@educandow/domain';

describe('PatchStudentUseCase', () => {
  let useCase: PatchStudentUseCase;
  let studentRepo: StudentRepository;
  let guardianRepo: StudentGuardianRepository;

  // Helper: build a mock Student entity
  function mockStudent(overrides: Record<string, unknown> = {}) {
    const id = { get: () => (overrides.id as string) ?? 's1' };
    const { id: _, ...restOverrides } = overrides;
    return {
      id,
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: { get: () => '12345678' },
      email: undefined,
      birthDate: undefined,
      guardianName: undefined,
      guardianPhone: undefined,
      address: undefined,
      phone: undefined,
      photoUrl: undefined,
      userId: 'user-student',
      institutionId: 'inst-1',
      active: true,
      deletedAt: undefined,
      fullName: 'Pérez, Juan',
      softDelete: () => {},
      ...restOverrides,
    } as unknown as Student;
  }

  beforeEach(() => {
    studentRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      findByUserId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      findByInstitution: vi.fn(),
      findByDni: vi.fn(),
      search: vi.fn(),
      delete: vi.fn(),
      setFechaDePase: vi.fn().mockResolvedValue(undefined),
    };
    guardianRepo = {
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      findByComposite: vi.fn(),
      findStudyTutor: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new PatchStudentUseCase(studentRepo, guardianRepo);
  });

  // ── STUDENT: allowed field ──────────────────────────────

  it('STUDENT edits own allowed field (phone)', async () => {
    const s = mockStudent({ userId: 'user-student' });
    vi.mocked(studentRepo.findById).mockResolvedValue(s);

    const result = await useCase.execute('s1', { phone: '2215551234' }, { userId: 'user-student', roles: ['STUDENT'] });

    expect(result).not.toBeNull();
    expect(studentRepo.save).toHaveBeenCalled();
  });

  // ── STUDENT: blocked field ──────────────────────────────

  it('STUDENT blocked on firstName → ForbiddenError', async () => {
    const s = mockStudent({ userId: 'user-student' });
    vi.mocked(studentRepo.findById).mockResolvedValue(s);

    await expect(
      useCase.execute('s1', { firstName: 'Nuevo' }, { userId: 'user-student', roles: ['STUDENT'] }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ── STUDENT: patches another student ────────────────────

  it('STUDENT patching another student → ForbiddenError', async () => {
    const s = mockStudent({ id: 's2', userId: 'user-other' });
    vi.mocked(studentRepo.findById).mockResolvedValue(s);

    await expect(
      useCase.execute('s2', { phone: '2215551234' }, { userId: 'user-student', roles: ['STUDENT'] }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ── TUTOR: allowed field on child ───────────────────────

  it('TUTOR edits allowed field on child', async () => {
    const child = mockStudent({ id: 's1', userId: 'user-child' });
    vi.mocked(studentRepo.findById).mockResolvedValue(child);
    vi.mocked(guardianRepo.findByGuardianUserId).mockResolvedValue([
      /* has guardian link */ { studentId: 's1' } as any,
    ]);

    const result = await useCase.execute('s1', { phone: '2215559999' }, { userId: 'user-tutor', roles: ['TUTOR'] });

    expect(result).not.toBeNull();
    expect(studentRepo.save).toHaveBeenCalled();
  });

  // ── TUTOR: non-child student → ForbiddenError ───────────

  it('TUTOR patching non-child → ForbiddenError', async () => {
    const s = mockStudent({ id: 's2', userId: 'user-other' });
    vi.mocked(studentRepo.findById).mockResolvedValue(s);
    vi.mocked(guardianRepo.findByGuardianUserId).mockResolvedValue([]);

    await expect(
      useCase.execute('s2', { phone: '2215559999' }, { userId: 'user-tutor', roles: ['TUTOR'] }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ── ADMIN: all fields ───────────────────────────────────

  it('ADMIN edits any field including firstName', async () => {
    const s = mockStudent();
    vi.mocked(studentRepo.findById).mockResolvedValue(s);

    const result = await useCase.execute('s1', { firstName: 'Nuevo', dni: '12345678' }, { userId: 'user-admin', roles: ['ADMIN'] });

    expect(result).not.toBeNull();
    expect(studentRepo.save).toHaveBeenCalled();
  });

  // ── Mixed allowed + blocked → ForbiddenError ────────────

  it('STUDENT with mixed fields (allowed + blocked) → ForbiddenError', async () => {
    const s = mockStudent({ userId: 'user-student' });
    vi.mocked(studentRepo.findById).mockResolvedValue(s);

    await expect(
      useCase.execute('s1', { phone: '2215551234', firstName: 'Nuevo' }, { userId: 'user-student', roles: ['STUDENT'] }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ── Student not found ───────────────────────────────────

  it('returns NotFoundError when student does not exist', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('s-nonexistent', { phone: '2215551234' }, { userId: 'user-admin', roles: ['ADMIN'] }),
    ).rejects.toThrow(NotFoundError);
  });
});
