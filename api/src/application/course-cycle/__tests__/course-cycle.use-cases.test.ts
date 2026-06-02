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
import { Id } from '@educandow/domain';

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
    findAll: vi.fn(),
    save: vi.fn(),
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

  it('rejects update on closed cycle', async () => {
    const cc = makeCC();
    cc.deactivate();
    mockRepo.findByUuid = vi.fn().mockResolvedValue(cc);

    const result = await useCase.execute(cc.uuid, { courseName: 'LENGUA' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleClosedError);
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

  it('generates CourseCycles for all courses in plan', async () => {
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
      { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
    ]);
    mockRepo.createMany = vi.fn().mockResolvedValue({ created: 2, skipped: 0, total: 2 });

    const result = await useCase.execute({ studyPlanId: 'plan-1', cycleId: 'cycle-1' });

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(2);
    expect(mockRepo.createMany).toHaveBeenCalled();
  });

  it('skips existing pairs', async () => {
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
      { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
    ]);
    mockRepo.createMany = vi.fn().mockResolvedValue({ created: 1, skipped: 1, total: 2 });

    const result = await useCase.execute({ studyPlanId: 'plan-1', cycleId: 'cycle-1' });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('rejects when academic cycle is inactive', async () => {
    mockCycleRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('cycle-1'),
      name: '2025',
      active: false,
      isCurrent: () => false,
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
    ]);

    await expect(useCase.execute({ studyPlanId: 'plan-1', cycleId: 'cycle-1' })).rejects.toThrow(AcademicCycleClosedError);
  });

  it('rejects when study plan is not found', async () => {
    mockPlanRepo.findById = vi.fn().mockResolvedValue(null);
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([]);

    await expect(useCase.execute({ studyPlanId: 'nonexistent', cycleId: 'cycle-1' })).rejects.toThrow();
  });
});
