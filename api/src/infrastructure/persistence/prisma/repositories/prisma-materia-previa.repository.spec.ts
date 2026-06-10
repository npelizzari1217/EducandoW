/**
 * PR3-T3 [RED] — PrismaMateriaPreviaRepository tests.
 * Mocks TenantContext; no real DB.
 * Specs: MP-R6, MP-R8, D2
 *
 * Verifies:
 * - saveMany upserts on unique (studentId, subjectId, originAcademicYear)
 * - findByStudent returns domain entities for that student
 * - findByStudentAndAcademicYear filters by year
 * - Cross-tenant isolation via TenantContext (throws when no client)
 * - All fields (condicion, status, resolvedAt, resolvedGradeCode) round-trip
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaMateriaPreviaRepository } from './prisma-materia-previa.repository';
import { TenantContext } from '../../../auth/tenant.context';
import {
  MateriaPrevia,
  MateriaPreviaStatus,
  SubjectFinalGradeCondicion,
} from '@educandow/domain';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── ORM row factory ────────────────────────────────────────────────────────────

function makeMateriaPreviaRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                   'mp-uuid-1',
    studentId:            'student-uuid-1',
    subjectId:            'subj-uuid-1',
    originAcademicYear:   '2024',
    originCourseCycleId:  null,
    condicion:            'PREVIA' as const,
    status:               'PENDIENTE' as const,
    resolvedGradeCode:    null,
    resolvedAt:           null,
    createdAt:            new Date('2026-01-01'),
    updatedAt:            new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ────────────────────────────────────────────────────────

function makeMockClient() {
  return {
    materiaPrevia: {
      findMany: vi.fn(),
      upsert:   vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByStudent
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaMateriaPreviaRepository — findByStudent', () => {
  let repo: PrismaMateriaPreviaRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaMateriaPreviaRepository();
  });

  it('returns empty array when no previas exist for the student', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([]);

    const result = await repo.findByStudent('student-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns domain MateriaPrevia entities for the student', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([
      makeMateriaPreviaRow({ id: 'mp-1' }),
      makeMateriaPreviaRow({ id: 'mp-2', subjectId: 'subj-uuid-2' }),
    ]);

    const result = await repo.findByStudent('student-uuid-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(MateriaPrevia);
    expect(result[1]).toBeInstanceOf(MateriaPrevia);
  });

  it('queries by studentId only', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([]);

    await repo.findByStudent('student-uuid-1');

    expect(mockClient.materiaPrevia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'student-uuid-1' }),
      }),
    );
  });

  it('maps all fields correctly — condicion, status, originAcademicYear', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([
      makeMateriaPreviaRow({
        condicion:           'LIBRE',
        status:              'APROBADA',
        resolvedGradeCode:   'MB',
        resolvedAt:          new Date('2026-03-15'),
        originCourseCycleId: 'cc-uuid-1',
        originAcademicYear:  '2023',
      }),
    ]);

    const result = await repo.findByStudent('student-uuid-1');

    expect(result[0].condicion).toBe(SubjectFinalGradeCondicion.LIBRE);
    expect(result[0].status).toBe(MateriaPreviaStatus.APROBADA);
    expect(result[0].resolvedGradeCode).toBe('MB');
    expect(result[0].resolvedAt).toBeInstanceOf(Date);
    expect(result[0].originCourseCycleId).toBe('cc-uuid-1');
    expect(result[0].originAcademicYear).toBe('2023');
  });

  it('cross-tenant isolation — TenantContext throws when no client (tenant-scoping guaranteed)', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);

    await expect(repo.findByStudent('student-uuid-1')).rejects.toThrow('TenantContext');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findByStudentAndAcademicYear
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaMateriaPreviaRepository — findByStudentAndAcademicYear', () => {
  let repo: PrismaMateriaPreviaRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaMateriaPreviaRepository();
  });

  it('returns empty array when no previas exist for the student/year', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([]);

    const result = await repo.findByStudentAndAcademicYear('student-uuid-1', '2024');

    expect(result).toHaveLength(0);
  });

  it('queries by both studentId and originAcademicYear', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([]);

    await repo.findByStudentAndAcademicYear('student-uuid-1', '2024');

    expect(mockClient.materiaPrevia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId:          'student-uuid-1',
          originAcademicYear: '2024',
        }),
      }),
    );
  });

  it('returns domain entities filtered by year', async () => {
    mockClient.materiaPrevia.findMany.mockResolvedValue([
      makeMateriaPreviaRow({ id: 'mp-1', originAcademicYear: '2024' }),
    ]);

    const result = await repo.findByStudentAndAcademicYear('student-uuid-1', '2024');

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(MateriaPrevia);
    expect(result[0].originAcademicYear).toBe('2024');
  });

  it('cross-tenant isolation — TenantContext throws when no client', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);

    await expect(
      repo.findByStudentAndAcademicYear('student-uuid-1', '2024'),
    ).rejects.toThrow('TenantContext');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// saveMany — upsert on unique key (MP-R6, D2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaMateriaPreviaRepository — saveMany', () => {
  let repo: PrismaMateriaPreviaRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  function makeEntity(overrides: Partial<{
    studentId: string;
    subjectId: string;
    originAcademicYear: string;
    condicion: SubjectFinalGradeCondicion;
  }> = {}): MateriaPrevia {
    const result = MateriaPrevia.create({
      studentId:          overrides.studentId ?? 'student-1',
      subjectId:          overrides.subjectId ?? 'subj-1',
      originAcademicYear: overrides.originAcademicYear ?? '2024',
      condicion:          overrides.condicion ?? SubjectFinalGradeCondicion.PREVIA,
    });
    if (result.isErr()) throw new Error('Factory failed: ' + result.unwrapErr().message);
    return result.unwrap();
  }

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaMateriaPreviaRepository();
  });

  it('calls upsert once per entity', async () => {
    mockClient.materiaPrevia.upsert.mockResolvedValue({});

    await repo.saveMany([makeEntity(), makeEntity({ subjectId: 'subj-2' })]);

    expect(mockClient.materiaPrevia.upsert).toHaveBeenCalledTimes(2);
  });

  it('upserts keyed on (studentId, subjectId, originAcademicYear)', async () => {
    mockClient.materiaPrevia.upsert.mockResolvedValue({});

    const entity = makeEntity();
    await repo.saveMany([entity]);

    expect(mockClient.materiaPrevia.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId_subjectId_originAcademicYear: {
            studentId:          entity.studentId,
            subjectId:          entity.subjectId,
            originAcademicYear: entity.originAcademicYear,
          },
        }),
      }),
    );
  });

  it('persists all fields in CREATE branch', async () => {
    mockClient.materiaPrevia.upsert.mockResolvedValue({});

    const entity = makeEntity({ condicion: SubjectFinalGradeCondicion.LIBRE });
    await repo.saveMany([entity]);

    expect(mockClient.materiaPrevia.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id:                 entity.id,
          studentId:          entity.studentId,
          subjectId:          entity.subjectId,
          originAcademicYear: entity.originAcademicYear,
          condicion:          'LIBRE',
          status:             'PENDIENTE',
        }),
      }),
    );
  });

  it('persists condicion and status in UPDATE branch', async () => {
    mockClient.materiaPrevia.upsert.mockResolvedValue({});

    const entity = makeEntity({ condicion: SubjectFinalGradeCondicion.PREVIA });
    await repo.saveMany([entity]);

    expect(mockClient.materiaPrevia.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          condicion: 'PREVIA',
          status:    'PENDIENTE',
        }),
      }),
    );
  });

  it('no-op (resolves without error) for empty array', async () => {
    await expect(repo.saveMany([])).resolves.toBeUndefined();
    expect(mockClient.materiaPrevia.upsert).not.toHaveBeenCalled();
  });

  it('cross-tenant isolation — TenantContext throws when no client', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);

    await expect(repo.saveMany([makeEntity()])).rejects.toThrow('TenantContext');
  });
});
