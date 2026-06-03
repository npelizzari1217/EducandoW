import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
} from '../use-cases/course-cycle.use-cases';
import type { CourseCycleRepository } from '@educandow/domain';
import type { CourseSectionRepository } from '@educandow/domain';
import type { AcademicCycleRepository } from '@educandow/domain';
import type { StudyPlanRepository } from '@educandow/domain';
import {
  CourseCycle,
  CourseName,
  PassingGrade,
  BimonthPeriod,
  Level,
  LevelType,
  CourseCycleClosedError,
  CourseCycleAlreadyExistsError,
  CourseCycleNotFoundError,
  CourseSection,
  AcademicCycleClosedError,
} from '@educandow/domain';
import { Id, NotFoundError } from '@educandow/domain';

// ── Helpers ──────────────────────────────────────────────────

const level = Level.reconstruct(LevelType.PRIMARIO);
const courseName = CourseName.create('MATEMÁTICA').unwrap();
const passingGrade = PassingGrade.create(6).unwrap();
const makeBimonth = (s: string, e: string) => BimonthPeriod.create(new Date(s), new Date(e)).unwrap();

function makeCC() {
  return CourseCycle.create({
    courseId: 'course-1',
    studyPlanId: 'plan-1',
    cycleId: 'cycle-1',
    courseName,
    level,
    passingGrade,
    promotionText: 'Aprueba con 6',
    firstBimonth: makeBimonth('2026-03-01', '2026-04-30'),
    secondBimonth: makeBimonth('2026-05-01', '2026-06-30'),
    thirdBimonth: makeBimonth('2026-07-01', '2026-08-31'),
    fourthBimonth: makeBimonth('2026-09-01', '2026-10-31'),
  });
}

function makeMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByUuid: vi.fn().mockResolvedValue(null),
    findByPair: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 }),
    save: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue({ created: 0, skipped: 0, total: 0 }),
    softDelete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as CourseCycleRepository;
}

function makeMockCourseSectionRepo(): CourseSectionRepository {
  return {
    findById: vi.fn().mockResolvedValue(CourseSection.reconstruct({
      id: Id.reconstruct('course-1'),
      name: 'Matemática',
      level,
      academicYear: '2026',
      institutionId: 'inst-1',
    })),
    // minimal mock
    findAll: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn(),
    findByLevel: vi.fn(),
  } as unknown as CourseSectionRepository;
}

function makeMockAcademicCycleRepo() {
  return {
    findById: vi.fn().mockResolvedValue({
      id: Id.reconstruct('cycle-1'),
      name: '2026',
      active: true,
      isCurrent: () => true,
    }),
    findByUuid: vi.fn().mockResolvedValue({
      id: Id.reconstruct('cycle-1'),
      name: '2026',
      active: true,
      isCurrent: () => true,
    }),
    findByCode: vi.fn().mockResolvedValue(null),
    findActive: vi.fn().mockResolvedValue([]),
    findAll: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn().mockResolvedValue(undefined),
  } as unknown as AcademicCycleRepository;
}

function makeMockStudyPlanRepo() {
  return {
    findById: vi.fn().mockResolvedValue({ id: Id.reconstruct('plan-1'), name: 'Plan 2026' }),
    findPlanCoursesByPlan: vi.fn().mockResolvedValue([]),
    findAll: vi.fn(),
    save: vi.fn(),
  } as unknown as StudyPlanRepository;
}

// ── CreateCourseCycleUseCase ──────────────────────────────

describe('CreateCourseCycleUseCase', () => {
  let useCase: CreateCourseCycleUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;
  let mockCourseRepo: CourseSectionRepository;
  let mockCycleRepo: ReturnType<typeof makeMockAcademicCycleRepo>;
  let mockPlanRepo: ReturnType<typeof makeMockStudyPlanRepo>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockCourseRepo = makeMockCourseSectionRepo();
    mockCycleRepo = makeMockAcademicCycleRepo();
    mockPlanRepo = makeMockStudyPlanRepo();
    useCase = new CreateCourseCycleUseCase(mockRepo, mockCourseRepo, mockCycleRepo, mockPlanRepo);
  });

  it('creates a CourseCycle successfully', async () => {
    const input = {
      courseId: 'course-1',
      studyPlanId: 'plan-1',
      cycleId: 'cycle-1',
      courseName: 'Matemática',
      level: 'PRIMARIO',
      passingGrade: 6,
      promotionText: 'Test',
      firstBimonthStart: '2026-03-01',
      firstBimonthEnd: '2026-04-30',
      secondBimonthStart: '2026-05-01',
      secondBimonthEnd: '2026-06-30',
      thirdBimonthStart: '2026-07-01',
      thirdBimonthEnd: '2026-08-31',
      fourthBimonthStart: '2026-09-01',
      fourthBimonthEnd: '2026-10-31',
    };

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    const cc = result.unwrap();
    expect(cc.courseName.get()).toBe('MATEMÁTICA');
    expect(cc.active).toBe(true);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('rejects duplicate (courseId, cycleId)', async () => {
    mockRepo.findByPair = vi.fn().mockResolvedValue(makeCC());
    const result = await useCase.execute({
      courseId: 'course-1', studyPlanId: 'plan-1', cycleId: 'cycle-1',
      courseName: 'Matemática', level: 'PRIMARIO', passingGrade: 6,
      firstBimonthStart: '2026-03-01', firstBimonthEnd: '2026-04-30',
      secondBimonthStart: '2026-05-01', secondBimonthEnd: '2026-06-30',
      thirdBimonthStart: '2026-07-01', thirdBimonthEnd: '2026-08-31',
      fourthBimonthStart: '2026-09-01', fourthBimonthEnd: '2026-10-31',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleAlreadyExistsError);
  });
});

// ── UpdateCourseCycleUseCase ──────────────────────────────

describe('UpdateCourseCycleUseCase', () => {
  let useCase: UpdateCourseCycleUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    useCase = new UpdateCourseCycleUseCase(mockRepo);
  });

  it('updates an active CourseCycle', async () => {
    const cc = makeCC();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    const result = await useCase.execute(cc.uuid, { courseName: 'LENGUA', passingGrade: 7 });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.courseName.get()).toBe('LENGUA');
    expect(updated.passingGrade.get()).toBe(7);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('allows update on closed cycle (active can be changed)', async () => {
    const cc = makeCC();
    cc.deactivate();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    const result = await useCase.execute(cc.uuid, { courseName: 'LENGUA' });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.courseName.get()).toBe('LENGUA');
  });

  it('rejects update on non-existent CourseCycle', async () => {
    mockRepo.findByUuid = vi.fn().mockResolvedValue(null);
    const result = await useCase.execute('nonexistent', { courseName: 'LENGUA' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleNotFoundError);
  });
});

// ── DeleteCourseCycleUseCase ──────────────────────────────

describe('DeleteCourseCycleUseCase', () => {
  let useCase: DeleteCourseCycleUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    useCase = new DeleteCourseCycleUseCase(mockRepo);
  });

  it('soft-deletes an active CourseCycle', async () => {
    const cc = makeCC();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    await useCase.execute(cc.uuid);

    expect(mockRepo.softDelete).toHaveBeenCalledWith(cc.uuid);
  });

  it('rejects delete on closed cycle', async () => {
    const cc = makeCC();
    cc.deactivate();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    await expect(useCase.execute(cc.uuid)).rejects.toThrow(CourseCycleClosedError);
  });
});

// ── ToggleCourseCycleActiveUseCase ───────────────────────

describe('ToggleCourseCycleActiveUseCase', () => {
  let useCase: ToggleCourseCycleActiveUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    useCase = new ToggleCourseCycleActiveUseCase(mockRepo);
  });

  it('deactivates an active CourseCycle', async () => {
    const cc = makeCC();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    const result = await useCase.execute(cc.uuid, false);

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.active).toBe(false);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('reactivates a closed CourseCycle', async () => {
    const cc = makeCC();
    cc.deactivate();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    const result = await useCase.execute(cc.uuid, true);

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.active).toBe(true);
  });
});

// ── GetCourseCycleUseCase ────────────────────────────────

describe('GetCourseCycleUseCase', () => {
  it('returns CourseCycle by uuid', async () => {
    const cc = makeCC();
    const mockRepo = makeMockRepo({ findByUuid: vi.fn().mockResolvedValue(cc) });
    const useCase = new GetCourseCycleUseCase(mockRepo);

    const result = await useCase.execute(cc.uuid);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().uuid).toBe(cc.uuid);
  });

  it('returns NotFound error', async () => {
    const mockRepo = makeMockRepo({ findByUuid: vi.fn().mockResolvedValue(null) });
    const useCase = new GetCourseCycleUseCase(mockRepo);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleNotFoundError);
  });
});

// ── ListCourseCyclesUseCase ──────────────────────────────

describe('ListCourseCyclesUseCase', () => {
  it('returns paginated results', async () => {
    const cc = makeCC();
    const mockRepo = makeMockRepo({
      findAll: vi.fn().mockResolvedValue({ data: [cc], page: 1, pageSize: 10, total: 1 }),
    });
    const useCase = new ListCourseCyclesUseCase(mockRepo);

    const result = await useCase.execute({ level: 20, active: true });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

// ── GenerateCourseCyclesUseCase ──────────────────────────

describe('GenerateCourseCyclesUseCase', () => {
  let useCase: GenerateCourseCyclesUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;
  let mockPlanRepo: ReturnType<typeof makeMockStudyPlanRepo>;
  let mockCycleRepo: ReturnType<typeof makeMockAcademicCycleRepo>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockPlanRepo = makeMockStudyPlanRepo();
    mockCycleRepo = makeMockAcademicCycleRepo();
    useCase = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo);
  });

  // 1. All new — no pre-existing CourseCycles
  it('creates all courses when none pre-exist (UPSERT)', async () => {
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
      { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
      { id: 'spc-3', courseSectionId: 'course-3', courseSectionName: 'Ciencias', studyPlanId: 'plan-1' },
      { id: 'spc-4', courseSectionId: 'course-4', courseSectionName: 'Historia', studyPlanId: 'plan-1' },
      { id: 'spc-5', courseSectionId: 'course-5', courseSectionName: 'Inglés', studyPlanId: 'plan-1' },
    ]);
    mockRepo.findByPair = vi.fn().mockResolvedValue(null); // none exist

    const result = await useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(result.created).toBe(5);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledTimes(5);
  });

  // 2. Some exist — update courseName, others create
  it('updates existing CourseCycles and creates new ones', async () => {
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
      { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
      { id: 'spc-3', courseSectionId: 'course-3', courseSectionName: 'Ciencias', studyPlanId: 'plan-1' },
      { id: 'spc-4', courseSectionId: 'course-4', courseSectionName: 'Historia', studyPlanId: 'plan-1' },
      { id: 'spc-5', courseSectionId: 'course-5', courseSectionName: 'Inglés', studyPlanId: 'plan-1' },
    ]);

    // Make first two courses "already exist"
    const existingCC1 = makeCC();
    const existingCC2 = makeCC();
    mockRepo.findByPair = vi.fn()
      .mockResolvedValueOnce(existingCC1)   // course-1 exists
      .mockResolvedValueOnce(existingCC2)   // course-2 exists
      .mockResolvedValue(null);             // rest are new

    const result = await useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(result.created).toBe(3);
    expect(result.updated).toBe(2);
    expect(result.total).toBe(5);
    // Verify update was called on existing CCs
    expect(existingCC1.courseName.get()).toBe('MATEMÁTICA');
    expect(existingCC2.courseName.get()).toBe('LENGUA');
    expect(mockRepo.save).toHaveBeenCalledTimes(5);
  });

  // 3. Level derived from plan via Level.fromParts
  it('derives level via Level.fromParts instead of hardcoding', async () => {
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan Talleres', level: 2, modality: 1,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Taller de Arte', studyPlanId: 'plan-1' },
    ]);
    mockRepo.findByPair = vi.fn().mockResolvedValue(null);

    // Spy on save to inspect the level set on the CourseCycle
    const result = await useCase.execute({ level: 21, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    // The saved CourseCycle should have level = 21 (Level.fromParts(2, 1))
    const savedCall = (mockRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedCall.level.toCode()).toBe(21);
  });

  // 4. studyPlanId absent — all plans for the level are processed
  it('processes all plans for the composite level when studyPlanId absent', async () => {
    const plan1 = {
      id: Id.reconstruct('plan-1'), name: 'Plan Primario A', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    };
    const plan2 = {
      id: Id.reconstruct('plan-2'), name: 'Plan Primario B', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    };
    const plan3 = {
      id: Id.reconstruct('plan-3'), name: 'Plan Talleres Primario', level: 2, modality: 1,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    };
    mockPlanRepo.findAll = vi.fn().mockResolvedValue([plan1, plan2, plan3]);
    mockPlanRepo.findPlanCoursesByPlan = vi.fn()
      .mockResolvedValueOnce([
        { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
        { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'spc-3', courseSectionId: 'course-3', courseSectionName: 'Ciencias', studyPlanId: 'plan-2' },
      ])
      .mockResolvedValueOnce([
        { id: 'spc-4', courseSectionId: 'course-4', courseSectionName: 'Taller Arte', studyPlanId: 'plan-3' },
      ]);
    mockRepo.findByPair = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({ level: 20, cycleId: 'cycle-1' });

    expect(result.created).toBe(4);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(4);
    expect(mockPlanRepo.findAll).toHaveBeenCalledWith(2); // Math.floor(20/10)
    expect(mockRepo.save).toHaveBeenCalledTimes(4);
  });

  // 5. studyPlanId absent — no plans found
  it('returns zeros when no plans match the level', async () => {
    mockPlanRepo.findAll = vi.fn().mockResolvedValue([]);

    const result = await useCase.execute({ level: 20, cycleId: 'cycle-1' });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(0);
    expect(mockPlanRepo.findAll).toHaveBeenCalledWith(2);
  });

  // 6. StudyPlan not found
  it('rejects when studyPlanId is provided but not found', async () => {
    mockPlanRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  // 7. AcademicCycle not found
  it('rejects when AcademicCycle is not found', async () => {
    mockCycleRepo.findByUuid = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute({ level: 20, cycleId: 'nonexistent-cycle', studyPlanId: 'plan-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  // 8. AcademicCycle is inactive
  it('rejects when AcademicCycle is inactive', async () => {
    mockCycleRepo.findByUuid = vi.fn().mockResolvedValue({
      id: Id.reconstruct('cycle-1'),
      name: '2025',
      active: false,
      isCurrent: () => false,
    });

    await expect(
      useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' }),
    ).rejects.toThrow(AcademicCycleClosedError);
  });
});
