/**
 * PR1-T12 [RED] — PrismaSubjectPeriodGradeRepository tests.
 * Mocks TenantContext; no real DB.
 * Specs: SPG-R4, SPG-R7, PPF-R9
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaSubjectPeriodGradeRepository } from './prisma-subject-period-grade.repository';
import { TenantContext } from '../../../auth/tenant.context';
import { SubjectPeriodGrade } from '@educandow/domain';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factory ───────────────────────────────────────────────────────────────

function makeSpgRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spg-uuid-1',
    studentId: 'student-uuid-1',
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-uuid-1',
    periodOrdinal: 1,
    gradeScaleValueId: null,
    gradeCode: null,
    internalStatus: null,
    pa: false,
    ppi: false,
    pp: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────────────────────

function makeMockClient() {
  return {
    subjectPeriodGrade: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByCourseCycleAndSubject
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectPeriodGradeRepository — findByCourseCycleAndSubject', () => {
  let repo: PrismaSubjectPeriodGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectPeriodGradeRepository();
  });

  it('returns empty array when no rows exist', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns all rows for the given (courseCycleId, subjectId) — all periods × all students', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([
      makeSpgRow({ id: 'spg-1', studentId: 'student-1', periodOrdinal: 1 }),
      makeSpgRow({ id: 'spg-2', studentId: 'student-1', periodOrdinal: 2 }),
      makeSpgRow({ id: 'spg-3', studentId: 'student-2', periodOrdinal: 1 }),
    ]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(SubjectPeriodGrade);
    expect(result[1]).toBeInstanceOf(SubjectPeriodGrade);
    expect(result[2]).toBeInstanceOf(SubjectPeriodGrade);
  });

  it('maps flags correctly', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([
      makeSpgRow({ pa: true, ppi: false, pp: true }),
    ]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result[0].pa).toBe(true);
    expect(result[0].ppi).toBe(false);
    expect(result[0].pp).toBe(true);
  });

  it('queries by courseCycleId and subjectId', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([]);

    await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(mockClient.subjectPeriodGrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-uuid-1',
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findByStudentAndCourseCycle
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectPeriodGradeRepository — findByStudentAndCourseCycle', () => {
  let repo: PrismaSubjectPeriodGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectPeriodGradeRepository();
  });

  it('returns empty array when no rows exist for the student', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([]);

    const result = await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns all rows for the student across all subjects and periods', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([
      makeSpgRow({ id: 'spg-1', subjectId: 'subj-1', periodOrdinal: 1 }),
      makeSpgRow({ id: 'spg-2', subjectId: 'subj-1', periodOrdinal: 2 }),
      makeSpgRow({ id: 'spg-3', subjectId: 'subj-2', periodOrdinal: 1 }),
    ]);

    const result = await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(result).toHaveLength(3);
  });

  it('queries by studentId and courseCycleId', async () => {
    mockClient.subjectPeriodGrade.findMany.mockResolvedValue([]);

    await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(mockClient.subjectPeriodGrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// saveMany (upsert semantics — SPG-R4)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectPeriodGradeRepository — saveMany', () => {
  let repo: PrismaSubjectPeriodGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectPeriodGradeRepository();
  });

  it('calls upsert once per grade (no duplicate rows created)', async () => {
    mockClient.subjectPeriodGrade.upsert.mockResolvedValue({});

    const grade1 = SubjectPeriodGrade.create({
      studentId: 'student-1',
      courseCycleId: 'cc-1',
      subjectId: 'subj-1',
      periodOrdinal: 1,
    });
    const grade2 = SubjectPeriodGrade.create({
      studentId: 'student-1',
      courseCycleId: 'cc-1',
      subjectId: 'subj-1',
      periodOrdinal: 2,
    });

    await repo.saveMany([grade1, grade2]);

    expect(mockClient.subjectPeriodGrade.upsert).toHaveBeenCalledTimes(2);
  });

  it('upserts keyed on (studentId, courseCycleId, subjectId, periodOrdinal)', async () => {
    mockClient.subjectPeriodGrade.upsert.mockResolvedValue({});

    const grade = SubjectPeriodGrade.create({
      studentId: 'student-1',
      courseCycleId: 'cc-1',
      subjectId: 'subj-1',
      periodOrdinal: 1,
    });

    await repo.saveMany([grade]);

    expect(mockClient.subjectPeriodGrade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId_courseCycleId_subjectId_periodOrdinal: {
            studentId: grade.studentId,
            courseCycleId: grade.courseCycleId,
            subjectId: grade.subjectId,
            periodOrdinal: grade.periodOrdinal,
          },
        }),
      }),
    );
  });

  it('includes grade fields AND pa/ppi/pp flags in the upsert payload', async () => {
    mockClient.subjectPeriodGrade.upsert.mockResolvedValue({});

    const grade = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-1',
      courseCycleId: 'cc-1',
      subjectId: 'subj-1',
      periodOrdinal: 1,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      pa: true,
      ppi: false,
      pp: true,
    });

    await repo.saveMany([grade]);

    expect(mockClient.subjectPeriodGrade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          gradeScaleValueId: 'sv-uuid-1',
          gradeCode: 'MB',
          internalStatus: 'APROBADO',
          pa: true,
          ppi: false,
          pp: true,
        }),
        update: expect.objectContaining({
          gradeScaleValueId: 'sv-uuid-1',
          gradeCode: 'MB',
          pa: true,
          ppi: false,
          pp: true,
        }),
      }),
    );
  });

  it('no-op (resolves without error) for empty array', async () => {
    await expect(repo.saveMany([])).resolves.toBeUndefined();
    expect(mockClient.subjectPeriodGrade.upsert).not.toHaveBeenCalled();
  });
});
