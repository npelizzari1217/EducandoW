import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMyChildrenUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentGuardianRepository, StudentRepository, Student } from '@educandow/domain';

describe('GetMyChildrenUseCase', () => {
  let useCase: GetMyChildrenUseCase;
  let guardianRepo: StudentGuardianRepository;
  let studentRepo: StudentRepository;

  function mockGuardian(overrides: Record<string, unknown> = {}) {
    return { studentId: overrides.studentId ?? 's1', userId: 'u-tutor' };
  }

  function mockStudent(overrides: Record<string, unknown> = {}) {
    return {
      id: { get: () => overrides.id ?? 's1' },
      firstName: 'Juan',
      lastName: 'Pérez',
      ...overrides,
    } as unknown as Student;
  }

  beforeEach(() => {
    guardianRepo = {
      findByGuardianUserId: vi.fn(),
      findById: vi.fn(),
      findByStudentId: vi.fn(),
      findByComposite: vi.fn(),
      findStudyTutor: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
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
    useCase = new GetMyChildrenUseCase(guardianRepo, studentRepo);
  });

  it('returns students linked as children to the tutor', async () => {
    const s1 = mockStudent({ id: 's1' });
    const s2 = mockStudent({ id: 's2' });

    vi.mocked(guardianRepo.findByGuardianUserId).mockResolvedValue([
      mockGuardian({ studentId: 's1' }) as any,
      mockGuardian({ studentId: 's2' }) as any,
    ]);
    vi.mocked(studentRepo.findById).mockImplementation(async (id: string) => {
      if (id === 's1') return s1;
      if (id === 's2') return s2;
      return null;
    });

    const result = await useCase.execute('u-tutor');
    expect(result).toHaveLength(2);
    expect(result).toContain(s1);
    expect(result).toContain(s2);
  });

  it('returns empty array when tutor has no children', async () => {
    vi.mocked(guardianRepo.findByGuardianUserId).mockResolvedValue([]);

    const result = await useCase.execute('u-tutor');
    expect(result).toEqual([]);
  });

  it('skips students that were not found by id', async () => {
    const s1 = mockStudent({ id: 's1' });

    vi.mocked(guardianRepo.findByGuardianUserId).mockResolvedValue([
      mockGuardian({ studentId: 's1' }) as any,
      mockGuardian({ studentId: 's-missing' }) as any,
    ]);
    vi.mocked(studentRepo.findById).mockImplementation(async (id: string) => {
      if (id === 's1') return s1;
      return null;
    });

    const result = await useCase.execute('u-tutor');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(s1);
  });
});
