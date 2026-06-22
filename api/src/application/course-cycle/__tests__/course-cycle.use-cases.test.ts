import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
  ListStudentsByCourseCycleUC,
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
    findGradingContextByUuid: vi.fn().mockResolvedValue(null),
    findEnrolledStudents: vi.fn().mockResolvedValue([]),
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
      institutionId: Id.reconstruct('inst-1'),
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
  it('returns { cycle, modality } when CourseCycle found (CCM-1)', async () => {
    const cc = makeCC();
    const mockRepo = makeMockRepo({
      findByUuid: vi.fn().mockResolvedValue(cc),
      findGradingContextByUuid: vi.fn().mockResolvedValue({ level: 20, modality: 0 }),
    });
    const useCase = new GetCourseCycleUseCase(mockRepo);

    const result = await useCase.execute(cc.uuid);

    expect(result.isOk()).toBe(true);
    const { cycle, modality } = result.unwrap();
    expect(cycle.uuid).toBe(cc.uuid);
    expect(modality).toBe(0);
  });

  it('returns modality=null when grading context not found', async () => {
    const cc = makeCC();
    const mockRepo = makeMockRepo({
      findByUuid: vi.fn().mockResolvedValue(cc),
      findGradingContextByUuid: vi.fn().mockResolvedValue(null),
    });
    const useCase = new GetCourseCycleUseCase(mockRepo);

    const result = await useCase.execute(cc.uuid);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().modality).toBeNull();
  });

  it('returns NotFound error when cycle does not exist (CCM-2)', async () => {
    const mockRepo = makeMockRepo({ findByUuid: vi.fn().mockResolvedValue(null) });
    const useCase = new GetCourseCycleUseCase(mockRepo);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleNotFoundError);
  });
});

// ── ListStudentsByCourseCycleUC ──────────────────────────

describe('ListStudentsByCourseCycleUC', () => {
  it('SBC-1: returns enrolled students when cycle exists', async () => {
    const cc = makeCC();
    const students = [
      { studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' },
      { studentId: 'stu-2', firstName: 'Ana', lastName: 'López' },
      { studentId: 'stu-3', firstName: 'Pedro', lastName: 'García' },
    ];
    const mockRepo = makeMockRepo({
      findByUuid: vi.fn().mockResolvedValue(cc),
      findEnrolledStudents: vi.fn().mockResolvedValue(students),
    });
    const useCase = new ListStudentsByCourseCycleUC(mockRepo);

    const result = await useCase.execute(cc.uuid);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' });
    expect(mockRepo.findEnrolledStudents).toHaveBeenCalledWith(cc.uuid);
  });

  it('SBC-2: throws CourseCycleNotFoundError when cycle does not exist', async () => {
    const mockRepo = makeMockRepo({ findByUuid: vi.fn().mockResolvedValue(null) });
    const useCase = new ListStudentsByCourseCycleUC(mockRepo);

    await expect(useCase.execute('cc-nonexistent')).rejects.toThrow(CourseCycleNotFoundError);
    expect(mockRepo.findEnrolledStudents).not.toHaveBeenCalled();
  });

  it('SBC-3: returns [] when cycle exists but has no enrolled students', async () => {
    const cc = makeCC();
    const mockRepo = makeMockRepo({
      findByUuid: vi.fn().mockResolvedValue(cc),
      findEnrolledStudents: vi.fn().mockResolvedValue([]),
    });
    const useCase = new ListStudentsByCourseCycleUC(mockRepo);

    const result = await useCase.execute(cc.uuid);

    expect(result).toEqual([]);
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

  it('passes levelIn to findAll when provided (SECRETARIO scope)', async () => {
    const cc = makeCC();
    const findAllMock = vi.fn().mockResolvedValue({ data: [cc], page: 1, pageSize: 20, total: 1 });
    const mockRepo = makeMockRepo({ findAll: findAllMock });
    const useCase = new ListCourseCyclesUseCase(mockRepo);

    await useCase.execute({ levelIn: [20] });

    expect(findAllMock).toHaveBeenCalledWith(
      expect.objectContaining({ levelIn: [20] }),
    );
  });

  it('does not pass levelIn when ADMIN (allLevels=true) calls with no levelIn', async () => {
    const findAllMock = vi.fn().mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
    const mockRepo = makeMockRepo({ findAll: findAllMock });
    const useCase = new ListCourseCyclesUseCase(mockRepo);

    await useCase.execute({ level: 20 });

    const call = findAllMock.mock.calls[0][0];
    expect(call.levelIn).toBeUndefined();
    expect(call.level).toBe(20);
  });
});

// ── GenerateCourseCyclesUseCase ──────────────────────────

describe('GenerateCourseCyclesUseCase', () => {
  let useCase: GenerateCourseCyclesUseCase;
  let mockRepo: ReturnType<typeof makeMockRepo>;
  let mockPlanRepo: ReturnType<typeof makeMockStudyPlanRepo>;
  let mockCycleRepo: ReturnType<typeof makeMockAcademicCycleRepo>;
  // autoCreateUC is fire-and-forget; mock to avoid unhandled rejections
  const mockAutoCreateUC = { execute: vi.fn().mockResolvedValue(undefined) } as never;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockPlanRepo = makeMockStudyPlanRepo();
    mockCycleRepo = makeMockAcademicCycleRepo();
    useCase = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo, mockAutoCreateUC);
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

  // 2b. Cascade runs on BOTH create and update (re-sync of competencies/students)
  it('runs the competency-valuation cascade for created AND updated course cycles', async () => {
    (mockAutoCreateUC as unknown as { execute: ReturnType<typeof vi.fn> }).execute.mockClear();
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
      { id: 'spc-2', courseSectionId: 'course-2', courseSectionName: 'Lengua', studyPlanId: 'plan-1' },
      { id: 'spc-3', courseSectionId: 'course-3', courseSectionName: 'Ciencias', studyPlanId: 'plan-1' },
    ]);
    const existingCC = makeCC();
    mockRepo.findByPair = vi.fn()
      .mockResolvedValueOnce(existingCC)  // course-1 exists → update
      .mockResolvedValue(null);            // course-2, course-3 new → create

    const result = await useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(result.updated).toBe(1);
    expect(result.created).toBe(2);
    // Cascade fired once per course — both the updated one and the two created ones
    expect((mockAutoCreateUC as unknown as { execute: ReturnType<typeof vi.fn> }).execute).toHaveBeenCalledTimes(3);
    expect((mockAutoCreateUC as unknown as { execute: ReturnType<typeof vi.fn> }).execute).toHaveBeenCalledWith({ courseCycleId: existingCC.uuid });
  });

  // 2c. Bimonth dates from the academic cycle are assigned to generated CourseCycles
  const cycleWithBimonths = {
    id: Id.reconstruct('cycle-1'),
    name: '2026',
    active: true,
    isCurrent: () => true,
    firstBimonth: makeBimonth('2026-03-10', '2026-05-10'),
    secondBimonth: makeBimonth('2026-05-11', '2026-07-10'),
    thirdBimonth: makeBimonth('2026-07-11', '2026-09-10'),
    fourthBimonth: makeBimonth('2026-09-11', '2026-11-10'),
  };

  it('assigns the academic cycle bimonth dates to newly created CourseCycles', async () => {
    mockCycleRepo.findByUuid = vi.fn().mockResolvedValue(cycleWithBimonths);
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
    ]);
    mockRepo.findByPair = vi.fn().mockResolvedValue(null);

    await useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    const saved = (mockRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(saved.firstBimonth?.start.toISOString()).toBe(new Date('2026-03-10').toISOString());
    expect(saved.firstBimonth?.end.toISOString()).toBe(new Date('2026-05-10').toISOString());
    expect(saved.fourthBimonth?.end.toISOString()).toBe(new Date('2026-11-10').toISOString());
  });

  it('overwrites existing CourseCycle bimonth dates with the cycle dates on regenerate', async () => {
    mockCycleRepo.findByUuid = vi.fn().mockResolvedValue(cycleWithBimonths);
    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
    ]);
    const existing = makeCC(); // tiene fechas '2026-03-01'... distintas a las del ciclo
    mockRepo.findByPair = vi.fn().mockResolvedValue(existing);

    await useCase.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(existing.firstBimonth?.start.toISOString()).toBe(new Date('2026-03-10').toISOString());
    expect(existing.fourthBimonth?.end.toISOString()).toBe(new Date('2026-11-10').toISOString());
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

  // T10 RED → T11 GREEN: esOptativa mapping through GenerateCourseCyclesUseCase
  describe('esOptativa forwarding to materializeMateriasUC (T10)', () => {
    const mockMaterializeUC = { execute: vi.fn().mockResolvedValue(undefined) };

    beforeEach(() => {
      mockMaterializeUC.execute.mockClear();
    });

    it('Test A (MGC-S30/S31): mixed esOptativa values forwarded to planSubjects', async () => {
      const uc = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo, mockAutoCreateUC, mockMaterializeUC as any);
      mockPlanRepo.findById = vi.fn().mockResolvedValue({
        id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
        academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
        {
          id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Mat', studyPlanId: 'plan-1',
          subjects: [
            { id: 'sps-1', subjectId: 'subj-1', esOptativa: false },
            { id: 'sps-2', subjectId: 'subj-2', esOptativa: true },
          ],
        },
      ]);
      mockRepo.findByPair = vi.fn().mockResolvedValue(null);

      await uc.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

      // Allow fire-and-forget to resolve
      await new Promise(r => setTimeout(r, 10));

      expect(mockMaterializeUC.execute).toHaveBeenCalledOnce();
      const planSubjects = mockMaterializeUC.execute.mock.calls[0][0].planSubjects as Array<{ subjectId: string; esOptativa?: boolean }>;
      expect(planSubjects.find(s => s.subjectId === 'subj-1')?.esOptativa).toBe(false);
      expect(planSubjects.find(s => s.subjectId === 'subj-2')?.esOptativa).toBe(true);
    });

    it('Test B (MGC-S32): 3 subjects [false, true, false] forwarded in order', async () => {
      const uc = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo, mockAutoCreateUC, mockMaterializeUC as any);
      mockPlanRepo.findById = vi.fn().mockResolvedValue({
        id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
        academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
        {
          id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Mat', studyPlanId: 'plan-1',
          subjects: [
            { id: 'sps-1', subjectId: 'subj-1', esOptativa: false },
            { id: 'sps-2', subjectId: 'subj-2', esOptativa: true },
            { id: 'sps-3', subjectId: 'subj-3', esOptativa: false },
          ],
        },
      ]);
      mockRepo.findByPair = vi.fn().mockResolvedValue(null);

      await uc.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });
      await new Promise(r => setTimeout(r, 10));

      const planSubjects = mockMaterializeUC.execute.mock.calls[0][0].planSubjects as Array<{ esOptativa?: boolean }>;
      expect(planSubjects[0].esOptativa).toBe(false);
      expect(planSubjects[1].esOptativa).toBe(true);
      expect(planSubjects[2].esOptativa).toBe(false);
    });

    it('Test C (MGC-S33 backward compat): subject with no esOptativa → forwarded as undefined (not coerced to false)', async () => {
      const uc = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo, mockAutoCreateUC, mockMaterializeUC as any);
      mockPlanRepo.findById = vi.fn().mockResolvedValue({
        id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
        academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
        {
          id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Mat', studyPlanId: 'plan-1',
          subjects: [{ id: 'sps-1', subjectId: 'subj-1' /* no esOptativa */ }],
        },
      ]);
      mockRepo.findByPair = vi.fn().mockResolvedValue(null);

      await uc.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });
      await new Promise(r => setTimeout(r, 10));

      const planSubjects = mockMaterializeUC.execute.mock.calls[0][0].planSubjects as Array<{ esOptativa?: boolean }>;
      expect(planSubjects[0].esOptativa).toBeUndefined();
    });
  });

  // ACT-5: autoCreateUC rejection is fire-and-forget — generate still succeeds
  it('succeeds even when autoCreateUC.execute rejects (fire-and-forget isolation)', async () => {
    const failingAutoCreateUC = { execute: vi.fn().mockRejectedValue(new Error('boom')) } as never;
    const uc = new GenerateCourseCyclesUseCase(mockRepo, mockPlanRepo, mockCycleRepo, failingAutoCreateUC);

    mockPlanRepo.findById = vi.fn().mockResolvedValue({
      id: Id.reconstruct('plan-1'), name: 'Plan 2026', level: 2, modality: 0,
      academicYear: '2026', active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPlanRepo.findPlanCoursesByPlan = vi.fn().mockResolvedValue([
      { id: 'spc-1', courseSectionId: 'course-1', courseSectionName: 'Matemática', studyPlanId: 'plan-1' },
    ]);
    mockRepo.findByPair = vi.fn().mockResolvedValue(null);

    const result = await uc.execute({ level: 20, cycleId: 'cycle-1', studyPlanId: 'plan-1' });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(1);
  });
});
