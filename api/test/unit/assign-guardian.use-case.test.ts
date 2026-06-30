import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignGuardianUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository, StudentGuardianRepository, Student, NotFoundError } from '@educandow/domain';

describe('AssignGuardianUseCase', () => {
  let useCase: AssignGuardianUseCase;
  let studentRepo: StudentRepository;
  let guardianRepo: StudentGuardianRepository;

  function mockStudent() {
    return { id: { get: () => 's1' } } as unknown as Student;
  }

  beforeEach(() => {
    studentRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      findByInstitution: vi.fn(),
      findByDni: vi.fn(),
      search: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      setFechaDePase: vi.fn().mockResolvedValue(undefined),
    };
    guardianRepo = {
      findByComposite: vi.fn(),
      findStudyTutor: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new AssignGuardianUseCase(studentRepo, guardianRepo);
  });

  // REQ-RYT-07-A: userId present → success Result
  it('returns ok when guardian assigned successfully (REQ-RYT-07-A)', async () => {
    const s = mockStudent();
    vi.mocked(studentRepo.findById).mockResolvedValue(s);
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute('s1', { userId: 'u-tutor', relationship: 'father' });
    expect(result.isOk()).toBe(true);
    expect(guardianRepo.save).toHaveBeenCalled();
  });

  // REQ-RYT-07-B: userId absent → USER_ID_REQUIRED
  it('returns err USER_ID_REQUIRED when userId is absent (REQ-RYT-07-B)', async () => {
    const result = await useCase.execute('s1', { userId: undefined as unknown as string, relationship: 'mother' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('USER_ID_REQUIRED');
  });

  // Student not found → err with NotFoundError
  it('returns err NOT_FOUND when student does not exist', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(null);
    const result = await useCase.execute('s-nonexistent', { userId: 'u-tutor', relationship: 'father' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // REQ-RYT-08-A: duplicate → GUARDIAN_ALREADY_ASSIGNED
  it('returns err GUARDIAN_ALREADY_ASSIGNED on duplicate (REQ-RYT-08-A)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue({} as any);
    const result = await useCase.execute('s1', { userId: 'u-tutor', relationship: 'other' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('GUARDIAN_ALREADY_ASSIGNED');
  });

  // Fix #7 (round-3) RED: portal-link with active:false must persist active:false
  // RED (before fix): AssignGuardianInput has no active field → defaults to true
  // GREEN (after fix): active is forwarded and saved as false
  it('(Round3-Fix7) portal-link with active:false persists active:false', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    // Cast to any: AssignGuardianInput doesn't have active yet (before the fix)
    const result = await useCase.execute('s1', {
      userId: 'u-parent',
      relationship: 'father',
      active: false,
    } as any);

    expect(result.isOk()).toBe(true);
    const saved = vi.mocked(guardianRepo.save).mock.calls[0][0];
    expect(saved.active).toBe(false);
  });

  // Round5-Bug6 RED: P2002 from save() must surface as GUARDIAN_ALREADY_ASSIGNED Result err (not thrown)
  it('(Round5-Bug6) P2002 from repo save() surfaces as err(GUARDIAN_ALREADY_ASSIGNED), not an unhandled throw', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null); // app-layer check passes
    // Repo throws ValidationError on P2002 (as the repo does on studentId+userId unique violation)
    const { ValidationError } = await import('@educandow/domain');
    vi.mocked(guardianRepo.save).mockRejectedValueOnce(new ValidationError('GUARDIAN_ALREADY_ASSIGNED'));

    const result = await useCase.execute('s1', { userId: 'u-tutor', relationship: 'father' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('GUARDIAN_ALREADY_ASSIGNED');
  });

  // Bug 4 RED: portal-link with fullName+mobile → fullName and mobile must be persisted
  it('(Bug4) portal-link with fullName and mobile persists them on the guardian', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute('s1', {
      userId: 'u-parent',
      relationship: 'father',
      fullName: 'Juan García',
      mobile: '+5491112345678',
    } as any);

    expect(result.isOk()).toBe(true);
    const saved = vi.mocked(guardianRepo.save).mock.calls[0][0];
    expect(saved.fullName).toBe('Juan García');
    expect(saved.mobile?.get()).toBe('+5491112345678');
  });
});
