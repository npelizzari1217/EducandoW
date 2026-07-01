import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaCourseCycleRepository } from '../prisma-course-cycle.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import * as enrolledStudentsQuery from '../../queries/enrolled-students.query';
import {
  CourseCycle,
  CourseName,
  PassingGrade,
  BimonthPeriod,
  Level,
  LevelType,
  GradingPhase,
} from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────────

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'cc-uuid-1',
    courseId: 'course-uuid-1',
    studyPlanId: 'plan-uuid-1',
    cycleId: 'cycle-uuid-1',
    courseName: 'MATEMÁTICA',
    level: 20,
    active: true,
    passingGrade: 6,
    promotionText: 'Aprueba con 6',
    firstBimStart: new Date('2026-03-01'),
    firstBimEnd: new Date('2026-04-30'),
    secondBimStart: new Date('2026-05-01'),
    secondBimEnd: new Date('2026-06-30'),
    thirdBimStart: new Date('2026-07-01'),
    thirdBimEnd: new Date('2026-08-31'),
    fourthBimStart: new Date('2026-09-01'),
    fourthBimEnd: new Date('2026-10-31'),
    lastModifiedAt: new Date('2026-01-01'),
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const level = Level.reconstruct(LevelType.PRIMARIO);
const courseName = CourseName.create('MATEMÁTICA').unwrap();
const passingGrade = PassingGrade.create(6).unwrap();
const makeBimonth = (s: string, e: string) => BimonthPeriod.create(new Date(s), new Date(e)).unwrap();

function makeDomainCC(overrides: Record<string, unknown> = {}): CourseCycle {
  return CourseCycle.create({
    courseId: 'course-uuid-1',
    studyPlanId: 'plan-uuid-1',
    cycleId: 'cycle-uuid-1',
    courseName,
    level,
    passingGrade,
    firstBimonth: makeBimonth('2026-03-01', '2026-04-30'),
    secondBimonth: makeBimonth('2026-05-01', '2026-06-30'),
    thirdBimonth: makeBimonth('2026-07-01', '2026-08-31'),
    fourthBimonth: makeBimonth('2026-09-01', '2026-10-31'),
    ...overrides,
  });
}

// ── toDomain ──────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — toDomain', () => {
  let repo: PrismaCourseCycleRepository;

  beforeEach(() => {
    repo = new PrismaCourseCycleRepository();
  });

  it('maps Prisma row to CourseCycle domain entity', () => {
    const row = makePrismaRow();
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.courseId).toBe('course-uuid-1');
    expect(cc.studyPlanId).toBe('plan-uuid-1');
    expect(cc.cycleId).toBe('cycle-uuid-1');
    expect(cc.courseName.get()).toBe('MATEMÁTICA');
    expect(cc.level.get()).toBe(LevelType.PRIMARIO);
    expect(cc.active).toBe(true);
    expect(cc.passingGrade.get()).toBe(6);
    expect(cc.promotionText).toBe('Aprueba con 6');
    expect(cc.uuid).toBe('cc-uuid-1');
    expect(cc.deletedAt).toBeNull();
  });

  it('maps inactive row correctly', () => {
    const row = makePrismaRow({ active: false, deletedAt: new Date('2026-06-01') });
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.active).toBe(false);
    expect(cc.deletedAt).toBeInstanceOf(Date);
  });

  it('maps null promotionText correctly', () => {
    const row = makePrismaRow({ promotionText: null });
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.promotionText).toBeNull();
  });

  // ── PR-1b: gradingPhase mapping ────────────────────────────

  it('maps a null gradingPhase column to gradingPhase=null (no active phase)', () => {
    const row = makePrismaRow({ gradingPhase: null });
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.gradingPhase).toBeNull();
  });

  it('maps a Prisma GradingPhase enum value to the GradingPhase VO', () => {
    const row = makePrismaRow({ gradingPhase: 'BIM_2' });
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.gradingPhase).not.toBeNull();
    expect(cc.gradingPhase?.code).toBe('BIM_2');
  });

  it('maps CIERRE correctly', () => {
    const row = makePrismaRow({ gradingPhase: 'CIERRE' });
    const toDomain = (repo as any).toDomain.bind(repo);
    const cc: CourseCycle = toDomain(row);

    expect(cc.gradingPhase?.code).toBe('CIERRE');
  });
});

// ── save ──────────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — save', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('upserts a CourseCycle correctly', async () => {
    const mockUpsert = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { upsert: mockUpsert } } as any);

    const repo = new PrismaCourseCycleRepository();
    const cc = makeDomainCC();
    await repo.save(cc);

    expect(mockUpsert).toHaveBeenCalled();
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where.uuid).toBe(cc.uuid);
    expect(args.create.courseId).toBe('course-uuid-1');
    expect(args.create.studyPlanId).toBe('plan-uuid-1');
    expect(args.create.cycleId).toBe('cycle-uuid-1');
    expect(args.create.courseName).toBe('MATEMÁTICA');
    expect(args.create.level).toBe(20);
    expect(args.create.active).toBe(true);
    expect(args.create.passingGrade).toBe(6);
  });

  // ── PR-1b: gradingPhase mapping ────────────────────────────

  it('maps gradingPhase=null (no active phase) to a null column on save', async () => {
    const mockUpsert = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { upsert: mockUpsert } } as any);

    const repo = new PrismaCourseCycleRepository();
    const cc = makeDomainCC();
    await repo.save(cc);

    const args = mockUpsert.mock.calls[0][0];
    expect(args.create.gradingPhase).toBeNull();
  });

  it('maps an active GradingPhase VO to its enum code on save', async () => {
    const mockUpsert = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { upsert: mockUpsert } } as any);

    const repo = new PrismaCourseCycleRepository();
    const cc = makeDomainCC();
    cc.setGradingPhase(GradingPhase.create('BIM_3').unwrap());
    await repo.save(cc);

    const args = mockUpsert.mock.calls[0][0];
    expect(args.create.gradingPhase).toBe('BIM_3');
  });
});

// ── findByPair ────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — findByPair', () => {
  it('returns CourseCycle when found', async () => {
    const mockFindFirst = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { findFirst: mockFindFirst } } as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findByPair('course-uuid-1', 'cycle-uuid-1');
    expect(result).not.toBeNull();
    expect(result!.courseId).toBe('course-uuid-1');
    expect(result!.cycleId).toBe('cycle-uuid-1');
  });

  it('returns null when not found', async () => {
    const mockFindFirst = vi.fn().mockResolvedValue(null);
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { findFirst: mockFindFirst } } as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findByPair('nonexistent', 'nonexistent');
    expect(result).toBeNull();
  });
});

// ── findByUuid ────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — findByUuid', () => {
  it('returns CourseCycle when found by uuid', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { findUnique: mockFindUnique } } as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findByUuid('cc-uuid-1');
    expect(result).not.toBeNull();
    expect(result!.uuid).toBe('cc-uuid-1');
  });

  it('returns null when not found by uuid', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue(null);
    vi.mocked(TenantContext.getClient).mockReturnValue({ courseCycle: { findUnique: mockFindUnique } } as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findByUuid('nonexistent');
    expect(result).toBeNull();
  });
});

// ── softDelete ────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — softDelete', () => {
  it('sets deletedAt and active=false', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(makePrismaRow({ active: false, deletedAt: new Date() }));
    const mockFindUnique = vi.fn().mockResolvedValue(makePrismaRow());
    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseCycle: { update: mockUpdate, findUnique: mockFindUnique },
    } as any);

    const repo = new PrismaCourseCycleRepository();
    await repo.softDelete('cc-uuid-1');

    expect(mockUpdate).toHaveBeenCalled();
    const args = mockUpdate.mock.calls[0][0];
    expect(args.where.uuid).toBe('cc-uuid-1');
    expect(args.data.active).toBe(false);
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });
});

// ── findAll ──────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — findAll', () => {
  it('returns paginated results with filters', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([makePrismaRow(), makePrismaRow({ uuid: 'cc-uuid-2' })]);
    const mockCount = vi.fn().mockResolvedValue(2);
    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseCycle: { findMany: mockFindMany, count: mockCount },
    } as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findAll({ level: 20, cycleId: 'cycle-uuid-1', active: true, page: 1, pageSize: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});

// ── findEnrolledStudents ──────────────────────────────────────

describe('PrismaCourseCycleRepository — findEnrolledStudents', () => {
  it('delegates to findEnrolledStudentsByCourseCycle helper and returns students', async () => {
    const mockFindEnrolled = vi.spyOn(enrolledStudentsQuery, 'findEnrolledStudentsByCourseCycle')
      .mockResolvedValue([
        { studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' },
        { studentId: 'stu-2', firstName: 'Ana', lastName: 'López' },
      ]);

    const mockClient = {};
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findEnrolledStudents('cc-uuid-1');

    expect(mockFindEnrolled).toHaveBeenCalledWith(mockClient, 'cc-uuid-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' });

    mockFindEnrolled.mockRestore();
  });

  it('returns [] when helper returns empty list', async () => {
    const mockFindEnrolled = vi.spyOn(enrolledStudentsQuery, 'findEnrolledStudentsByCourseCycle')
      .mockResolvedValue([]);

    vi.mocked(TenantContext.getClient).mockReturnValue({} as any);

    const repo = new PrismaCourseCycleRepository();
    const result = await repo.findEnrolledStudents('cc-empty');

    expect(result).toEqual([]);
    mockFindEnrolled.mockRestore();
  });
});

// ── createMany ────────────────────────────────────────────────

describe('PrismaCourseCycleRepository — createMany', () => {
  it('creates multiple CourseCycles with skipDuplicates', async () => {
    const mockCreateMany = vi.fn().mockResolvedValue({ count: 3 });
    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseCycle: { createMany: mockCreateMany },
    } as any);

    const repo = new PrismaCourseCycleRepository();
    const ccs = [makeDomainCC(), makeDomainCC({ courseId: 'course-2' })];
    const result = await repo.createMany(ccs);

    expect(result.created).toBe(3);
    expect(result.total).toBe(2);
    expect(mockCreateMany).toHaveBeenCalled();
    expect(mockCreateMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it('handles partial skips', async () => {
    const mockCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseCycle: { createMany: mockCreateMany },
    } as any);

    const repo = new PrismaCourseCycleRepository();
    const ccs = [makeDomainCC(), makeDomainCC({ courseId: 'course-2' })];
    const result = await repo.createMany(ccs);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(2);
  });
});
