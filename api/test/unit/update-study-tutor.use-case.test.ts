import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateStudyTutorUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentGuardianRepository, StudentGuardian, NotFoundError, Id, Mobile } from '@educandow/domain';

describe('UpdateStudyTutorUseCase', () => {
  let useCase: UpdateStudyTutorUseCase;
  let guardianRepo: StudentGuardianRepository;

  function mockGuardian(overrides: Partial<{
    id: string;
    studentId: string;
    fullName: string;
    mobile: string;
    active: boolean;
  }> = {}): StudentGuardian {
    const now = new Date();
    return StudentGuardian.reconstruct({
      id: Id.reconstruct(overrides.id ?? 'g1'),
      studentId: overrides.studentId ?? 's1',
      userId: undefined,
      relationship: 'abuela',
      fullName: overrides.fullName ?? 'Ana García',
      mobile: Mobile.reconstruct(overrides.mobile ?? '+5492215551234'),
      email: undefined,
      isFinancialResponsible: false,
      isAuthorizedToPickUp: false,
      active: overrides.active ?? true,
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

  // REQ-RYT-06-A: update fullName and mobile → success
  it('updates fullName and mobile successfully (REQ-RYT-06-A)', async () => {
    const guardian = mockGuardian();
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({
      guardianId: 'g1',
      fullName: 'Ana G. López',
      mobile: '+5492215554321',
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.fullName).toBe('Ana G. López');
    expect(updated.mobile?.get()).toBe('+5492215554321');
    expect(guardianRepo.save).toHaveBeenCalled();
  });

  // REQ-RYT-06-B: toggle active to false
  it('deactivates guardian when active=false is passed (REQ-RYT-06-B)', async () => {
    const guardian = mockGuardian({ active: true });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ guardianId: 'g1', active: false });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().active).toBe(false);
  });

  // REQ-RYT-06-C: guardian not found → GUARDIAN_NOT_FOUND
  it('returns err GUARDIAN_NOT_FOUND when guardian does not exist (REQ-RYT-06-C)', async () => {
    vi.mocked(guardianRepo.findById).mockResolvedValue(null);

    const result = await useCase.execute({ guardianId: 'g-missing', fullName: 'Ana' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(result.unwrapErr().message).toContain('GUARDIAN_NOT_FOUND');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // REQ-RYT-06-D: email null → clears email
  it('clears email when null is passed (REQ-RYT-06-D)', async () => {
    const guardian = mockGuardian();
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ guardianId: 'g1', email: null });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().email).toBeUndefined();
  });

  // fullName change triggers uniqueness re-check: duplicate without override → TUTOR_DUPLICATE_NAME
  it('returns err TUTOR_DUPLICATE_NAME when new fullName conflicts with existing tutor', async () => {
    const guardian = mockGuardian({ fullName: 'Ana García' });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({} as StudentGuardian);

    const result = await useCase.execute({ guardianId: 'g1', fullName: 'Otra Persona' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('TUTOR_DUPLICATE_NAME');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });
});
