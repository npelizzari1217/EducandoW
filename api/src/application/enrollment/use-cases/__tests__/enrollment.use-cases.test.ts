import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateEnrollmentUseCase,
  ToggleEnrollmentFlagUseCase,
  BulkToggleEnrollmentFlagsUseCase,
  BulkToggleEnrollmentFlagsInput,
} from '../enrollment.use-cases';
import type { EnrollmentRepository } from '@educandow/domain';
import { Enrollment, Id, Level, LevelType, EnrollmentStatus } from '@educandow/domain';
import type { AutoCreateCompetencyValuationsUC } from '../../../pedagogy/use-cases/competency.use-cases';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEnrollment(overrides: { printable?: boolean; promoted?: boolean } = {}): Enrollment {
  return Enrollment.reconstruct({
    id: Id.create(),
    studentId: Id.create(),
    institutionId: Id.create(),
    level: Level.reconstruct(LevelType.PRIMARIO),
    academicYear: '2025',
    grade: '3',
    division: 'A',
    status: EnrollmentStatus.reconstruct('ACTIVE'),
    enrolledAt: new Date(),
    printable: overrides.printable ?? true,
    promoted: overrides.promoted ?? false,
  });
}

function makeMockRepo(overrides: Partial<EnrollmentRepository> = {}): EnrollmentRepository {
  return {
    findById: vi.fn(),
    findByStudent: vi.fn(),
    findByInstitution: vi.fn(),
    findByCycleId: vi.fn(),
    findByCourse: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    saveMany: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    ...overrides,
  };
}

// ── CreateEnrollmentUseCase ───────────────────────────────────────────────────

describe('CreateEnrollmentUseCase', () => {
  let repo: EnrollmentRepository;
  let autoCreateUC: AutoCreateCompetencyValuationsUC;

  beforeEach(() => {
    repo = makeMockRepo({
      findActive: vi.fn().mockResolvedValue(null),
    });
    autoCreateUC = {
      executeForNewEnrollment: vi.fn().mockResolvedValue(undefined),
      executeForEnrollment: vi.fn().mockResolvedValue(undefined),
      executeForSubjectAssignment: vi.fn().mockResolvedValue(undefined),
    } as unknown as AutoCreateCompetencyValuationsUC;
  });

  it('creates enrollment successfully and triggers auto-creation', async () => {
    const uc = new CreateEnrollmentUseCase(repo, autoCreateUC);
    const result = await uc.execute({
      studentId: '00000000-0000-0000-0000-000000000001',
      institutionId: '00000000-0000-0000-0000-000000000002',
      level: 'PRIMARIO',
      academicYear: '2026',
      grade: '3°',
      division: 'A',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalled();
    expect(autoCreateUC.executeForNewEnrollment).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.objectContaining({ grade: '3°', division: 'A', academicYear: '2026' }),
    );
  });

  it('returns err when enrollment already exists for level and year', async () => {
    const existing = makeEnrollment();
    vi.mocked(repo.findActive).mockResolvedValue(existing);

    const uc = new CreateEnrollmentUseCase(repo, autoCreateUC);
    const result = await uc.execute({
      studentId: '00000000-0000-0000-0000-000000000001',
      institutionId: '00000000-0000-0000-0000-000000000002',
      level: 'PRIMARIO',
      academicYear: '2025',
    });

    expect(result.isErr()).toBe(true);
    expect(autoCreateUC.executeForNewEnrollment).not.toHaveBeenCalled();
  });

  it('does NOT throw if auto-creation fails (fire-and-forget acceptable)', async () => {
    vi.mocked(autoCreateUC.executeForNewEnrollment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('No client available'),
    );

    const uc = new CreateEnrollmentUseCase(repo, autoCreateUC);
    // Should not throw even if auto-creation fails
    await expect(
      uc.execute({
        studentId: '00000000-0000-0000-0000-000000000001',
        institutionId: '00000000-0000-0000-0000-000000000002',
        level: 'PRIMARIO',
        academicYear: '2026',
      }),
    ).resolves.toBeDefined();
  });

  it('works without autoCreateUC (backward compat — autoCreateUC is optional)', async () => {
    const uc = new CreateEnrollmentUseCase(repo);
    const result = await uc.execute({
      studentId: '00000000-0000-0000-0000-000000000001',
      institutionId: '00000000-0000-0000-0000-000000000002',
      level: 'PRIMARIO',
      academicYear: '2026',
    });
    expect(result.isOk()).toBe(true);
  });
});

// ── ToggleEnrollmentFlagUseCase ───────────────────────────────────────────────

describe('ToggleEnrollmentFlagUseCase', () => {
  let repo: EnrollmentRepository;
  let useCase: ToggleEnrollmentFlagUseCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new ToggleEnrollmentFlagUseCase(repo);
  });

  it('toggles printable flag using entity togglePrintable()', async () => {
    const enrollment = makeEnrollment({ printable: true });
    vi.mocked(repo.findById).mockResolvedValue(enrollment);

    const result = await useCase.execute(enrollment.id.get(), 'printable');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().printable).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(enrollment);
  });

  it('toggles promoted flag using entity togglePromoted()', async () => {
    const enrollment = makeEnrollment({ promoted: false });
    vi.mocked(repo.findById).mockResolvedValue(enrollment);

    const result = await useCase.execute(enrollment.id.get(), 'promoted');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().promoted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(enrollment);
  });

  it('returns NotFoundError when enrollment does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    const result = await useCase.execute('non-existent-id', 'printable');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('non-existent-id');
  });
});

// ── BulkToggleEnrollmentFlagsUseCase ─────────────────────────────────────────

describe('BulkToggleEnrollmentFlagsUseCase', () => {
  let repo: EnrollmentRepository;
  let useCase: BulkToggleEnrollmentFlagsUseCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new BulkToggleEnrollmentFlagsUseCase(repo);
  });

  it('uses findByCourse with full criteria (cycleId + level + grade + division)', async () => {
    const enrollments = [makeEnrollment(), makeEnrollment()];
    vi.mocked(repo.findByCourse).mockResolvedValue(enrollments);

    const input: BulkToggleEnrollmentFlagsInput = {
      cycleId: 'cycle-1',
      level: 6,
      grade: '3',
      division: 'A',
      academicYear: '2025',
      flag: 'printable',
      value: false,
    };

    const count = await useCase.execute(input);

    expect(repo.findByCourse).toHaveBeenCalledWith({
      cycleId: 'cycle-1',
      level: 6,
      grade: '3',
      division: 'A',
      academicYear: '2025',
    });
    expect(count).toBe(2);
  });

  it('sets printable on all matched enrollments and calls saveMany', async () => {
    const e1 = makeEnrollment({ printable: true });
    const e2 = makeEnrollment({ printable: true });
    vi.mocked(repo.findByCourse).mockResolvedValue([e1, e2]);

    const input: BulkToggleEnrollmentFlagsInput = {
      cycleId: 'cycle-1',
      flag: 'printable',
      value: false,
    };

    await useCase.execute(input);

    expect(e1.printable).toBe(false);
    expect(e2.printable).toBe(false);
    expect(repo.saveMany).toHaveBeenCalledWith([e1, e2]);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sets promoted on all matched enrollments and calls saveMany', async () => {
    const e1 = makeEnrollment({ promoted: false });
    const e2 = makeEnrollment({ promoted: false });
    vi.mocked(repo.findByCourse).mockResolvedValue([e1, e2]);

    const input: BulkToggleEnrollmentFlagsInput = {
      cycleId: 'cycle-1',
      flag: 'promoted',
      value: true,
    };

    await useCase.execute(input);

    expect(e1.promoted).toBe(true);
    expect(e2.promoted).toBe(true);
    expect(repo.saveMany).toHaveBeenCalledWith([e1, e2]);
  });

  it('returns 0 and calls saveMany with empty array when no enrollments match', async () => {
    vi.mocked(repo.findByCourse).mockResolvedValue([]);

    const count = await useCase.execute({ cycleId: 'cycle-1', flag: 'printable', value: false });

    expect(count).toBe(0);
    expect(repo.saveMany).toHaveBeenCalledWith([]);
  });

  it('does NOT call findByCycleId — uses findByCourse instead', async () => {
    vi.mocked(repo.findByCourse).mockResolvedValue([]);

    await useCase.execute({ cycleId: 'cycle-1', flag: 'printable', value: false });

    expect(repo.findByCycleId).not.toHaveBeenCalled();
    expect(repo.findByCourse).toHaveBeenCalled();
  });
});
