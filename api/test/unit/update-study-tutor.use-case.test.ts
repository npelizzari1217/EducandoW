import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateStudyTutorUseCase } from '../../src/application/student/use-cases/student.use-cases';
import { StudentGuardianRepository, StudentGuardian, NotFoundError, Id, Mobile, Email } from '@educandow/domain';

describe('UpdateStudyTutorUseCase', () => {
  let useCase: UpdateStudyTutorUseCase;
  let guardianRepo: StudentGuardianRepository;

  function mockGuardian(overrides: Partial<{
    id: string;
    studentId: string;
    fullName: string;
    mobile: string;
    active: boolean;
    email: string;
    isFinancialResponsible: boolean;
    isAuthorizedToPickUp: boolean;
  }> = {}): StudentGuardian {
    const now = new Date();
    return StudentGuardian.reconstruct({
      id: Id.reconstruct(overrides.id ?? 'g1'),
      studentId: overrides.studentId ?? 's1',
      userId: undefined,
      relationship: 'abuela',
      fullName: overrides.fullName ?? 'Ana García',
      mobile: Mobile.reconstruct(overrides.mobile ?? '+5492215551234'),
      email: overrides.email ? Email.reconstruct(overrides.email) : undefined,
      isFinancialResponsible: overrides.isFinancialResponsible ?? false,
      isAuthorizedToPickUp: overrides.isAuthorizedToPickUp ?? false,
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

  // Bug 2 RED: PATCH with only active=false must NOT clear existing email
  it('(Bug2) partial PATCH active=false preserves existing email', async () => {
    const guardian = mockGuardian({ email: 'stored@example.com', active: true });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ guardianId: 'g1', active: false });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().active).toBe(false);
    expect(result.unwrap().email?.get()).toBe('stored@example.com');
  });

  // Bug 5 RED: PATCH toggling isFinancialResponsible must persist the flag
  it('(Bug5) PATCH toggling isFinancialResponsible=true persists the flag', async () => {
    const guardian = mockGuardian({ isFinancialResponsible: false });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ guardianId: 'g1', isFinancialResponsible: true } as any);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().isFinancialResponsible).toBe(true);
  });

  // Bug 5 RED: PATCH toggling isAuthorizedToPickUp must persist the flag
  it('(Bug5) PATCH toggling isAuthorizedToPickUp=true persists the flag', async () => {
    const guardian = mockGuardian({ isAuthorizedToPickUp: false });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ guardianId: 'g1', isAuthorizedToPickUp: true } as any);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().isAuthorizedToPickUp).toBe(true);
  });

  // fullName change triggers uniqueness re-check: duplicate without override → TUTOR_DUPLICATE_NAME
  it('returns err TUTOR_DUPLICATE_NAME when new fullName conflicts with existing tutor', async () => {
    const guardian = mockGuardian({ fullName: 'Ana García' });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue({ active: true } as StudentGuardian);

    const result = await useCase.execute({ guardianId: 'g1', fullName: 'Otra Persona' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('TUTOR_DUPLICATE_NAME');
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // Bug 1 RED→GREEN: PATCH with guardianId that belongs to a DIFFERENT student must return NotFoundError
  it('(Bug1) PATCH with guardianId belonging to different student returns NotFoundError', async () => {
    // guardian belongs to studentId 's1'
    const guardian = mockGuardian({ id: 'g1', studentId: 's1' });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    // But request is for student 's2' — cross-student mutation attempt
    const result = await useCase.execute({ studentId: 's2', guardianId: 'g1', fullName: 'Hacker' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });

  // Bug 1: same studentId as the guardian's → must succeed
  it('(Bug1) PATCH with matching studentId succeeds normally', async () => {
    const guardian = mockGuardian({ id: 'g1', studentId: 's1' });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);
    vi.mocked(guardianRepo.findStudyTutor).mockResolvedValue(null);
    vi.mocked(guardianRepo.save).mockResolvedValue(undefined);

    const result = await useCase.execute({ studentId: 's1', guardianId: 'g1', fullName: 'Ana G. López' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().fullName).toBe('Ana G. López');
  });

  // Bug 5 round-2 RED→GREEN: update with whitespace-only relationship must be rejected
  it('(Bug5-round2) update with whitespace-only relationship returns validation error', async () => {
    const guardian = mockGuardian({ studentId: 's1' });
    vi.mocked(guardianRepo.findById).mockResolvedValue(guardian);

    const result = await useCase.execute({ guardianId: 'g1', relationship: '   ' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/cannot be empty/i);
    expect(guardianRepo.save).not.toHaveBeenCalled();
  });
});
