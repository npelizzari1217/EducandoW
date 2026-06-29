import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateStudyTutorUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository, StudentGuardianRepository, Student, NotFoundError } from '@educandow/domain';

describe('CreateStudyTutorUseCase', () => {
  let useCase: CreateStudyTutorUseCase;
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
    useCase = new CreateStudyTutorUseCase(studentRepo, guardianRepo);
  });

  // REQ-RYT-05-A: success — no userId, active true, defaults false
  it('creates study tutor with no userId, active=true, booleans default false (REQ-RYT-05-A)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Ana García',
      mobile: '+5492215551234',
      relationship: 'tutor',
    });

    expect(result.isOk()).toBe(true);
    const guardian = result.unwrap();
    expect(guardian.userId).toBeUndefined();
    expect(guardian.active).toBe(true);
    expect(guardian.isFinancialResponsible).toBe(false);
    expect(guardian.isAuthorizedToPickUp).toBe(false);
    expect(guardianRepo.save).toHaveBeenCalled();
  });

  // REQ-RYT-05-B: fullName missing → FULL_NAME_REQUIRED
  it('returns err FULL_NAME_REQUIRED when fullName is absent (REQ-RYT-05-B)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: '',
      mobile: '+5492215551234',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('FULL_NAME_REQUIRED');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // REQ-RYT-05-C: mobile missing → MOBILE_REQUIRED
  it('returns err MOBILE_REQUIRED when mobile is absent (REQ-RYT-05-C)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Lucía Rodríguez',
      mobile: '',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('MOBILE_REQUIRED');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // REQ-RYT-05-D: invalid mobile format → propagated from Mobile VO
  it('propagates Mobile VO error for invalid mobile format (REQ-RYT-05-D)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Lucía Rodríguez',
      mobile: '123',
    });

    expect(result.isErr()).toBe(true);
  });

  // REQ-RYT-05-E: valid email included → success
  it('persists email when valid email is provided (REQ-RYT-05-E)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Lucía Rodríguez',
      mobile: '+5492215559999',
      email: 'lucia@example.com',
      relationship: 'tutor',
    });

    expect(result.isOk()).toBe(true);
    const guardian = result.unwrap();
    expect(guardian.email?.get()).toBe('lucia@example.com');
  });

  // REQ-RYT-05-F: invalid email → propagated from Email VO
  it('propagates Email VO error for invalid email (REQ-RYT-05-F)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Lucía Rodríguez',
      mobile: '+5492215559999',
      email: 'not-an-email',
    });

    expect(result.isErr()).toBe(true);
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // REQ-RYT-08-B: duplicate fullName without allowDuplicate → TUTOR_DUPLICATE_NAME
  it('returns err TUTOR_DUPLICATE_NAME on name duplicate without override (REQ-RYT-08-B)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({} as any);

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Ana García',
      mobile: '+5492215551234',
      relationship: 'tutor',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('TUTOR_DUPLICATE_NAME');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // REQ-RYT-08-C: duplicate fullName with allowDuplicate: true → success
  it('succeeds with allowDuplicate=true even when name duplicate exists (REQ-RYT-08-C)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({} as any);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Ana García',
      mobile: '+5492215551234',
      relationship: 'tutor',
      allowDuplicate: true,
    });

    expect(result.isOk()).toBe(true);
    expect(guardianRepo.save).toHaveBeenCalled();
  });

  // User decision: relationship required on create → RELATIONSHIP_REQUIRED
  it('returns err RELATIONSHIP_REQUIRED when relationship is absent (user decision)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Ana García',
      mobile: '+5492215551234',
      // relationship intentionally omitted
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('RELATIONSHIP_REQUIRED');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // User decision: whitespace-only relationship → RELATIONSHIP_REQUIRED
  it('returns err RELATIONSHIP_REQUIRED when relationship is whitespace-only', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());

    const result = await useCase.execute({
      studentId: 's1',
      fullName: 'Ana García',
      mobile: '+5492215551234',
      relationship: '   ',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('RELATIONSHIP_REQUIRED');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // Student not found → NotFoundError
  it('returns err NOT_FOUND when student does not exist', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute({
      studentId: 's-missing',
      fullName: 'Ana García',
      mobile: '+5492215551234',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });
});
