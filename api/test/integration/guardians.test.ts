import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssignGuardianUseCase,
  RemoveGuardianUseCase,
  ListGuardiansUseCase,
  CreateStudyTutorUseCase,
  UpdateStudyTutorUseCase,
} from '../../src/application/student/use-cases/student.use-cases';
import {
  StudentGuardian,
  StudentGuardianRepository,
  StudentRepository,
  Student,
  NotFoundError,
  ValidationError,
  Id,
  Mobile,
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

      const result = await useCase.execute('s1', {
        userId: 'u-tutor',
        relationship: 'mother',
      });

      expect(result.isOk()).toBe(true);
      expect(guardianRepo.save).toHaveBeenCalled();
      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(false);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(false);
    });

    it('creates guardian with explicit boolean fields', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);

      const result = await useCase.execute('s1', {
        userId: 'u-tutor',
        relationship: 'father',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: false,
      });

      expect(result.isOk()).toBe(true);
      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(true);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(false);
    });

    it('creates guardian with both booleans true', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue(null);

      const result = await useCase.execute('s1', {
        userId: 'u-parent',
        relationship: 'legal_guardian',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: true,
      });

      expect(result.isOk()).toBe(true);
      const savedGuardian = vi.mocked(guardianRepo.save).mock.calls[0][0];
      expect(savedGuardian.isFinancialResponsible).toBe(true);
      expect(savedGuardian.isAuthorizedToPickUp).toBe(true);
    });

    it('returns err NOT_FOUND when student does not exist', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute('s-nonexistent', {
        userId: 'u-tutor',
        relationship: 'father',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it('returns err GUARDIAN_ALREADY_ASSIGNED on duplicate guardian', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findByComposite).mockResolvedValue({} as StudentGuardian);

      const result = await useCase.execute('s1', {
        userId: 'u-tutor',
        relationship: 'other',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('GUARDIAN_ALREADY_ASSIGNED');
    });

    it('returns err USER_ID_REQUIRED when userId is absent (REQ-RYT-07-B)', async () => {
      const result = await useCase.execute('s1', {
        userId: undefined as unknown as string,
        relationship: 'mother',
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('USER_ID_REQUIRED');
    });
  });

  // ── CreateStudyTutorUseCase ────

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

    // RYT-05-A, RYT-13-B: POST without userId → 201, study tutor created
    it('creates study tutor with no userId (RYT-05-A)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
      vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        studentId: 's1',
        fullName: 'Lucía Rodríguez',
        mobile: '+5492215559999',
        relationship: 'tutor',
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().userId).toBeUndefined();
    });

    // RYT-08-B: uniqueness (studentId, fullName) → second create with same name → 409
    it('rejects duplicate name without allowDuplicate (RYT-08-B)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({} as StudentGuardian);

      const result = await useCase.execute({
        studentId: 's1',
        fullName: 'Ana García',
        mobile: '+5492215551234',
        relationship: 'tutor',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('TUTOR_DUPLICATE_NAME');
    });

    // RYT-08-C: allowDuplicate: true → second create succeeds
    it('allows duplicate name with allowDuplicate=true (RYT-08-C)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({} as StudentGuardian);
      vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        studentId: 's1',
        fullName: 'Ana García',
        mobile: '+5492215551234',
        relationship: 'tutor',
        allowDuplicate: true,
      });

      expect(result.isOk()).toBe(true);
    });

    // RYT-04-A: free-text relationship stored as-is
    it('stores free-text relationship as-is (RYT-04-A)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
      vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        studentId: 's1',
        fullName: 'Ana García',
        mobile: '+5492215551234',
        relationship: 'abuela',
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().relationship).toBe('abuela');
    });

    // RYT-04-B: relationship of 16 chars → entity validation error
    it('rejects relationship of 16 characters (RYT-04-B)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue(mockStudent());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);

      const result = await useCase.execute({
        studentId: 's1',
        fullName: 'Ana García',
        mobile: '+5492215551234',
        relationship: 'a'.repeat(16),
      });

      expect(result.isErr()).toBe(true);
    });
  });

  // ── UpdateStudyTutorUseCase ────

  describe('UpdateStudyTutorUseCase', () => {
    let useCase: UpdateStudyTutorUseCase;
    let guardianRepo: StudentGuardianRepository;

    function mockGuardian(): StudentGuardian {
      const now = new Date();
      return StudentGuardian.reconstruct({
        id: Id.reconstruct('g1'),
        studentId: 's1',
        userId: undefined,
        relationship: 'abuela',
        fullName: 'Ana García',
        mobile: Mobile.reconstruct('+5492215551234'),
        email: undefined,
        isFinancialResponsible: false,
        isAuthorizedToPickUp: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

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
      useCase = new UpdateStudyTutorUseCase(guardianRepo);
    });

    // RYT-06-A, RYT-13-C: PATCH mobile → HTTP 200, updated value
    it('updates mobile successfully (RYT-06-A)', async () => {
      vi.mocked(guardianRepo.findById).mockResolvedValue(mockGuardian());
      vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
      vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ guardianId: 'g1', mobile: '+5492215554321' });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().mobile?.get()).toBe('+5492215554321');
    });

    // RYT-06-B, RYT-13-D: PATCH active=false → guardian deactivated
    it('deactivates guardian when active=false is passed (RYT-06-B)', async () => {
      vi.mocked(guardianRepo.findById).mockResolvedValue(mockGuardian());
      vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ guardianId: 'g1', active: false });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().active).toBe(false);
    });

    // RYT-06-C: guardian not found → 404
    it('returns err NOT_FOUND when guardian does not exist (RYT-06-C)', async () => {
      vi.mocked(guardianRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute({ guardianId: 'g-missing', active: false });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
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
      userId: string | undefined,
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

    it('returns list of guardians with boolean fields (RYT-12-A)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue({ id: { get: () => 's1' } } as unknown as Student);
      vi.mocked(guardianRepo.findByStudentId).mockResolvedValue([
        mockGuardian('g1', 's1', 'u1', 'mother', true, false),
        mockGuardian('g2', 's1', 'u2', 'father', false, true),
      ]);

      const result = await useCase.execute('s1');

      expect(result).toHaveLength(2);
      // Use toMatchObject to allow additional fields from extended GuardianOutput
      expect(result[0]).toMatchObject({
        id: 'g1',
        userId: 'u1',
        relationship: 'mother',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: false,
        active: true,
      });
      expect(result[1]).toMatchObject({
        id: 'g2',
        userId: 'u2',
        relationship: 'father',
        isFinancialResponsible: false,
        isAuthorizedToPickUp: true,
        active: true,
      });
    });

    // RYT-12-A: includes study tutors with null userId
    it('includes study tutor with null userId in guardian list (RYT-12-A)', async () => {
      vi.mocked(studentRepo.findById).mockResolvedValue({ id: { get: () => 's1' } } as unknown as Student);
      vi.mocked(guardianRepo.findByStudentId).mockResolvedValue([
        mockGuardian('g1', 's1', 'u1', 'mother', true, false),
        mockGuardian('g2', 's1', undefined, 'abuela', false, false),
      ]);

      const result = await useCase.execute('s1');

      expect(result).toHaveLength(2);
      expect(result[1]).toMatchObject({ id: 'g2', userId: undefined, relationship: 'abuela' });
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
