/**
 * PR2-T8 [RED] — PrismaSubjectFinalGradeRepository tests.
 * Mocks TenantContext; no real DB.
 * Specs: SFG-R5, SFG-R7, AD-2
 *
 * CRITICAL: Tests explicitly verify that save() persists ALL fields
 * (gradeCode, gradeScaleValueId, type, passed) in BOTH create and update
 * branches of the upsert, and that toDomain reads them back correctly.
 * (Round-trip regression lesson from PR1 teacher-identity review.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaSubjectFinalGradeRepository } from './prisma-subject-final-grade.repository';
import { TenantContext } from '../../../auth/tenant.context';
import { SubjectFinalGrade, SubjectFinalGradeType } from '@educandow/domain';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factory ───────────────────────────────────────────────────────────────

function makeSfgRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                'sfg-uuid-1',
    studentId:         'student-uuid-1',
    courseCycleId:     'cc-uuid-1',
    subjectId:         'subj-uuid-1',
    type:              'FINAL' as const,
    gradeScaleValueId: null,
    gradeCode:         null,
    internalStatus:    null,
    passed:            null,
    createdAt:         new Date('2026-01-01'),
    updatedAt:         new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────────────────────

function makeMockClient() {
  return {
    subjectFinalGrade: {
      findMany: vi.fn(),
      upsert:   vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByCourseCycleAndSubject
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectFinalGradeRepository — findByCourseCycleAndSubject', () => {
  let repo: PrismaSubjectFinalGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectFinalGradeRepository();
  });

  it('returns empty array when no rows exist', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns all rows for the given (courseCycleId, subjectId) — all types × all students', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([
      makeSfgRow({ id: 'sfg-1', studentId: 'student-1', type: 'FINAL' }),
      makeSfgRow({ id: 'sfg-2', studentId: 'student-1', type: 'DICIEMBRE' }),
      makeSfgRow({ id: 'sfg-3', studentId: 'student-2', type: 'FINAL' }),
    ]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(SubjectFinalGrade);
    expect(result[1]).toBeInstanceOf(SubjectFinalGrade);
  });

  it('maps type, gradeCode, gradeScaleValueId, and passed correctly (toDomain round-trip)', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([
      makeSfgRow({
        type:              'DEFINITIVA',
        gradeScaleValueId: 'sv-1',
        gradeCode:         'A',
        internalStatus:    'APROBADO',
        passed:            true,
      }),
    ]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result[0].type).toBe(SubjectFinalGradeType.DEFINITIVA);
    expect(result[0].gradeScaleValueId).toBe('sv-1');
    expect(result[0].gradeCode).toBe('A');
    expect(result[0].internalStatus).toBe('APROBADO');
    expect(result[0].passed).toBe(true);
  });

  it('queries by courseCycleId and subjectId', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([]);

    await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(mockClient.subjectFinalGrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseCycleId: 'cc-uuid-1',
          subjectId:     'subj-uuid-1',
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findByStudentAndCourseCycle
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectFinalGradeRepository — findByStudentAndCourseCycle', () => {
  let repo: PrismaSubjectFinalGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectFinalGradeRepository();
  });

  it('returns empty array when no rows exist for the student', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([]);

    const result = await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns all rows for the student across all subjects and types', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([
      makeSfgRow({ id: 'sfg-1', subjectId: 'subj-1', type: 'FINAL' }),
      makeSfgRow({ id: 'sfg-2', subjectId: 'subj-1', type: 'DICIEMBRE' }),
      makeSfgRow({ id: 'sfg-3', subjectId: 'subj-2', type: 'FINAL' }),
    ]);

    const result = await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(result).toHaveLength(3);
  });

  it('queries by studentId and courseCycleId', async () => {
    mockClient.subjectFinalGrade.findMany.mockResolvedValue([]);

    await repo.findByStudentAndCourseCycle('student-1', 'cc-uuid-1');

    expect(mockClient.subjectFinalGrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId:     'student-1',
          courseCycleId: 'cc-uuid-1',
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// saveMany — upsert + round-trip (SFG-R5 + CRITICAL save() field coverage)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectFinalGradeRepository — saveMany', () => {
  let repo: PrismaSubjectFinalGradeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectFinalGradeRepository();
  });

  it('calls upsert once per grade', async () => {
    mockClient.subjectFinalGrade.upsert.mockResolvedValue({});

    const grade1 = SubjectFinalGrade.create({
      studentId:     'student-1',
      courseCycleId: 'cc-1',
      subjectId:     'subj-1',
      type:          SubjectFinalGradeType.FINAL,
    });
    const grade2 = SubjectFinalGrade.create({
      studentId:     'student-1',
      courseCycleId: 'cc-1',
      subjectId:     'subj-2',
      type:          SubjectFinalGradeType.FINAL,
    });

    await repo.saveMany([grade1, grade2]);

    expect(mockClient.subjectFinalGrade.upsert).toHaveBeenCalledTimes(2);
  });

  it('upserts keyed on (studentId, courseCycleId, subjectId, type)', async () => {
    mockClient.subjectFinalGrade.upsert.mockResolvedValue({});

    const grade = SubjectFinalGrade.create({
      studentId:     'student-1',
      courseCycleId: 'cc-1',
      subjectId:     'subj-1',
      type:          SubjectFinalGradeType.MARZO,
    });

    await repo.saveMany([grade]);

    expect(mockClient.subjectFinalGrade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId_courseCycleId_subjectId_type: {
            studentId:     grade.studentId,
            courseCycleId: grade.courseCycleId,
            subjectId:     grade.subjectId,
            type:          grade.type,
          },
        }),
      }),
    );
  });

  it('CRITICAL: persists gradeCode, gradeScaleValueId, type, and passed in CREATE branch', async () => {
    mockClient.subjectFinalGrade.upsert.mockResolvedValue({});

    const grade = SubjectFinalGrade.reconstruct({
      id:                'sfg-uuid-1',
      studentId:         'student-1',
      courseCycleId:     'cc-1',
      subjectId:         'subj-1',
      type:              SubjectFinalGradeType.DEFINITIVA,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode:         'MB',
      internalStatus:    'APROBADO',
      passed:            true,
    });

    await repo.saveMany([grade]);

    expect(mockClient.subjectFinalGrade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          gradeScaleValueId: 'sv-uuid-1',
          gradeCode:         'MB',
          internalStatus:    'APROBADO',
          type:              'DEFINITIVA',
          passed:            true,
        }),
      }),
    );
  });

  it('CRITICAL: persists gradeCode, gradeScaleValueId, type, and passed in UPDATE branch', async () => {
    mockClient.subjectFinalGrade.upsert.mockResolvedValue({});

    const grade = SubjectFinalGrade.reconstruct({
      id:                'sfg-uuid-1',
      studentId:         'student-1',
      courseCycleId:     'cc-1',
      subjectId:         'subj-1',
      type:              SubjectFinalGradeType.DEFINITIVA,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode:         'MB',
      internalStatus:    'APROBADO',
      passed:            true,
    });

    await repo.saveMany([grade]);

    expect(mockClient.subjectFinalGrade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          gradeScaleValueId: 'sv-uuid-1',
          gradeCode:         'MB',
          internalStatus:    'APROBADO',
          passed:            true,
        }),
      }),
    );
  });

  it('no-op (resolves without error) for empty array', async () => {
    await expect(repo.saveMany([])).resolves.toBeUndefined();
    expect(mockClient.subjectFinalGrade.upsert).not.toHaveBeenCalled();
  });

  it('cross-institutionId isolation — TenantContext scopes the client (no rows returned for foreign tenant)', async () => {
    // TenantContext.getClient() throws when no tenant is active.
    // This verifies the repo ALWAYS goes through TenantContext (never raw prisma).
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);

    await expect(repo.saveMany([
      SubjectFinalGrade.create({
        studentId:     'student-1',
        courseCycleId: 'cc-1',
        subjectId:     'subj-1',
        type:          SubjectFinalGradeType.FINAL,
      }),
    ])).rejects.toThrow('TenantContext');
  });
});
