import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoveGuardianUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentGuardianRepository, StudentGuardian, NotFoundError, Id } from '@educandow/domain';

describe('RemoveGuardianUseCase', () => {
  let useCase: RemoveGuardianUseCase;
  let guardianRepo: StudentGuardianRepository;

  beforeEach(() => {
    guardianRepo = {
      findById: vi.fn(),
      delete: vi.fn(),
      findByStudentId: vi.fn(),
      findByGuardianUserId: vi.fn(),
      findByComposite: vi.fn(),
      findStudyTutor: vi.fn(),
      save: vi.fn(),
    };
    useCase = new RemoveGuardianUseCase(guardianRepo);
  });

  it('deletes guardian successfully', async () => {
    const mockGuardian = {
      id: Id.create('sg1'),
      studentId: 's1',
      userId: 'u-tutor',
      relationship: 'father',
      createdAt: new Date(),
    } as unknown as StudentGuardian;

    vi.mocked(guardianRepo.findById).mockResolvedValue(mockGuardian);
    vi.mocked(guardianRepo.delete).mockResolvedValue(undefined);

    await expect(useCase.execute('sg1')).resolves.toBeUndefined();
    expect(guardianRepo.delete).toHaveBeenCalledWith('sg1');
  });

  it('throws NotFoundError when guardian does not exist', async () => {
    vi.mocked(guardianRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute('sg-missing')).rejects.toThrow(NotFoundError);
  });
});
