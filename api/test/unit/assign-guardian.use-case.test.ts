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
