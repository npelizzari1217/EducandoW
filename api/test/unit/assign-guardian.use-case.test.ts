import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignGuardianUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository, StudentGuardianRepository, Student, NotFoundError, ValidationError } from '@educandow/domain';

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

  it('assigns guardian successfully', async () => {
    const s = mockStudent();
    vi.mocked(studentRepo.findById).mockResolvedValue(s);
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    await expect(
      useCase.execute('s1', { userId: 'u-tutor', relationship: 'mother' }),
    ).resolves.toBeUndefined();

    expect(guardianRepo.save).toHaveBeenCalled();
  });

  it('throws 404 when student does not exist', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('s-nonexistent', { userId: 'u-tutor', relationship: 'father' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws 409 when guardian already assigned (duplicate)', async () => {
    vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
    vi.mocked(guardianRepo.findByComposite).mockResolvedValue({} as any);

    await expect(
      useCase.execute('s1', { userId: 'u-tutor', relationship: 'other' }),
    ).rejects.toThrow(ValidationError);
  });
});
