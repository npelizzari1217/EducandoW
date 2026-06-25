import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMyStudentDataUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentRepository, Student, NotFoundError } from '@educandow/domain';

describe('GetMyStudentDataUseCase', () => {
  let useCase: GetMyStudentDataUseCase;
  let studentRepo: StudentRepository;

  function mockStudent(overrides: Record<string, unknown> = {}) {
    return {
      id: { get: () => overrides.id ?? 's1' },
      firstName: 'Juan',
      lastName: 'Pérez',
      userId: 'user-student',
      ...overrides,
    } as unknown as Student;
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
    useCase = new GetMyStudentDataUseCase(studentRepo);
  });

  it('returns Student when userId matches', async () => {
    const s = mockStudent();
    vi.mocked(studentRepo.findByUserId).mockResolvedValue(s);

    const result = await useCase.execute('user-student');
    expect(result).toBe(s);
  });

  it('throws NotFoundError when no student has that userId', async () => {
    vi.mocked(studentRepo.findByUserId).mockResolvedValue(null);

    await expect(useCase.execute('nonexistent')).rejects.toThrow(NotFoundError);
  });
});
