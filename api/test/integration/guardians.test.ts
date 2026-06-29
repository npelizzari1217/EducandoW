import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssignGuardianUseCase,
  RemoveGuardianUseCase,
  ListGuardiansUseCase,
} from '../../src/application/student/use-cases/student.use-cases';
import {
  StudentGuardian,
  StudentGuardianRepository,
  StudentRepository,
  Student,
  NotFoundError,
  ValidationError,
  Id,
} from '@educandow/domain';

describe('Guardian Integration Tests', () => {
  // ── AssignGuardianUseCase with boolean fields ────

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

    it('creates guardian with default boolean fields (false)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);

      await useCase.execute('s1', {
        userId: 'u-tutor',
        relationship: 'mother',
      });

      expect(guardianRepo.save).toHaveBeenCalled();
      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(false);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(false);
    });

    it('creates guardian with explicit boolean fields', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);

      await useCase.execute('s1', {
        userId: 'u-tutor',
        relationship: 'father',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: false,
      });

      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(true);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(false);
    });

    it('creates guardian with both booleans true', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);

      await useCase.execute('s1', {
        userId: 'u-parent',
        relationship: 'legal_guardian',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: true,
      });

      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(true);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(true);
    });

    it('throws 404 when student does not exist', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(null);

      await expect(
        useCase.execute('s-nonexistent', {
          userId: 'u-tutor',
          relationship: 'father',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws 409 on duplicate guardian', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue({} as StudentGuardian);

      await expect(
        useCase.execute('s1', {
          userId: 'u-tutor',
          relationship: 'other',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── ListGuardiansUseCase ────────────────

  describe('ListGuardiansUseCase', () => {
    let useCase: ListGuardiansUseCase;
    let studentRepo: StudentRepository;
    let guardianRepo: StudentGuardianRepository;

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
      useCase = new ListGuardiansUseCase(studentRepo, guardianRepo);
    });

    function mockGuardian(
      id: string,
      studentId: string,
      userId: string,
      relationship: string,
      isFinancialResponsible = false,
      isAuthorizedToPickUp = false,
    ): StudentGuardian {
      const now = new Date();
      return StudentGuardian.reconstruct({
        id: Id.reconstruct(id),
        studentId,
        userId,
        relationship,
        fullName: undefined,
        mobile: undefined,
        email: undefined,
        isFinancialResponsible,
        isAuthorizedToPickUp,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    it('returns list of guardians with boolean fields', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue({ id: { get: () => 's1' } } as unknown as Student);
      vi.mocked(guardianRepo.findByStudentId).mockResolvedValue([
        mockGuardian('g1', 's1', 'u1', 'mother', true, false),
        mockGuardian('g2', 's1', 'u2', 'father', false, true),
      ]);

      const result = await useCase.execute('s1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'g1',
        userId: 'u1',
        relationship: 'mother',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: false,
      });
      expect(result[1]).toEqual({
        id: 'g2',
        userId: 'u2',
        relationship: 'father',
        isFinancialResponsible: false,
        isAuthorizedToPickUp: true,
      });
    });

    it('returns empty array when no guardians', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue({ id: { get: () => 's2' } } as unknown as Student);
      vi.mocked(guardianRepo.findByStudentId).mockResolvedValue([]);

      const result = await useCase.execute('s2');

      expect(result).toEqual([]);
    });

    it('throws 404 when student does not exist', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('s-nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ── RemoveGuardianUseCase ──────────────

  describe('RemoveGuardianUseCase', () => {
    let useCase: RemoveGuardianUseCase;
    let guardianRepo: StudentGuardianRepository;

    beforeEach(() => {
      guardianRepo = {
        findByComposite: vi.fn(),
        findStudyTutor: vi.fn(),
        save: vi.fn(),
        findById: vi.fn(),
        findByStudentId: vi.fn(),
        findByGuardianUserId: vi.fn(),
        delete: vi.fn(),
      };
      useCase = new RemoveGuardianUseCase(guardianRepo);
    });

    it('removes guardian successfully', async () => {
      vi.mocked(guardianRepo.findById).mockResolvedValue({} as StudentGuardian);

      await expect(useCase.execute('g1')).resolves.toBeUndefined();
      expect(guardianRepo.delete).toHaveBeenCalledWith('g1');
    });

    it('throws 404 when guardian does not exist', async () => {
      vi.mocked(guardianRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute('g-nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
