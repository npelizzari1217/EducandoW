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

    const result = await useCase.execute('sg1');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeUndefined();
    expect(guardianRepo.delete).toHaveBeenCalledWith('sg1');
  });

  it('returns err(NotFoundError) when guardian does not exist', async () => {
    vi.mocked(guardianRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute('sg-missing');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // Round4-Bug1: DELETE cross-student ownership guard
  it('(Round4-Bug1-Delete) returns err(NotFoundError) when guardianId belongs to a different student', async () => {
    const mockGuardian = {
      id: { get: () => 'sg1' },
      studentId: 's1', // guardian belongs to student s1
      relationship: 'father',
      createdAt: new Date(),
    } as unknown as StudentGuardian;

    vi.mocked(guardianRepo.findById).mockResolvedValue(mockGuardian);
    vi.mocked(guardianRepo.delete).mockResolvedValue(undefined);

    // Request is for student 's2' — cross-student deletion attempt
    const result = await useCase.execute('sg1', 's2');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(guardianRepo.delete).not.toHaveBeenCalled();
  });

  it('(Round4-Bug1-Delete) succeeds when studentId matches the guardian\'s student', async () => {
    const mockGuardian = {
      id: { get: () => 'sg1' },
      studentId: 's1',
      relationship: 'father',
      createdAt: new Date(),
    } as unknown as StudentGuardian;

    vi.mocked(guardianRepo.findById).mockResolvedValue(mockGuardian);
    vi.mocked(guardianRepo.delete).mockResolvedValue(undefined);

    const result = await useCase.execute('sg1', 's1');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeUndefined();
    expect(guardianRepo.delete).toHaveBeenCalledWith('sg1');
  });
});
