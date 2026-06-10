/**
 * PR4-T9 [RED] — ListMateriasPreviasByStudentUseCase tests.
 * Specs: MP-R6, MP-R8, MP-R9, D2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListMateriasPreviasByStudentUseCase } from './list-materias-previas-by-student.use-case';
import {
  MateriaPrevia,
  MateriaPreviaStatus,
  SubjectFinalGradeCondicion,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePrevia(overrides: Partial<{
  studentId: string;
  subjectId: string;
  originAcademicYear: string;
  condicion: SubjectFinalGradeCondicion;
}> = {}): MateriaPrevia {
  return MateriaPrevia.reconstruct({
    id: `previa-${Math.random()}`,
    studentId: overrides.studentId ?? 'stu-1',
    subjectId: overrides.subjectId ?? 'subj-1',
    originAcademicYear: overrides.originAcademicYear ?? '2024',
    condicion: overrides.condicion ?? SubjectFinalGradeCondicion.PREVIA,
    status: MateriaPreviaStatus.PENDIENTE,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(previas: MateriaPrevia[] = []) {
  return {
    findByStudent: vi.fn().mockResolvedValue(previas),
    findByStudentAndAcademicYear: vi.fn().mockResolvedValue(previas),
    saveMany: vi.fn().mockResolvedValue(undefined),
  };
}

function makeTenantClient(studentExists = true) {
  return {
    student: {
      findUnique: vi.fn().mockResolvedValue(studentExists ? { id: 'stu-1' } : null),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ListMateriasPreviasByStudentUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListMateriasPreviasByStudentUseCase', () => {
  let useCase: ListMateriasPreviasByStudentUseCase;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makeTenantClient(true) as any,
    );
  });

  // ── All previas (no year filter) ─────────────────────────────────────────────

  it('MP-R8: returns all previas for student when no academicYear filter', async () => {
    const previas = [
      makePrevia({ originAcademicYear: '2023' }),
      makePrevia({ originAcademicYear: '2024' }),
    ];
    repo = makeRepo(previas);
    useCase = new ListMateriasPreviasByStudentUseCase(repo as any);

    const result = await useCase.execute({ studentId: 'stu-1' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
    expect(repo.findByStudent).toHaveBeenCalledWith('stu-1');
    expect(repo.findByStudentAndAcademicYear).not.toHaveBeenCalled();
  });

  // ── Filtered by academicYear ─────────────────────────────────────────────────

  it('MP-R9: filters by academicYear when param provided', async () => {
    const previas2024 = [makePrevia({ originAcademicYear: '2024' })];
    repo = makeRepo(previas2024);
    useCase = new ListMateriasPreviasByStudentUseCase(repo as any);

    const result = await useCase.execute({ studentId: 'stu-1', academicYear: '2024' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(repo.findByStudentAndAcademicYear).toHaveBeenCalledWith('stu-1', '2024');
    expect(repo.findByStudent).not.toHaveBeenCalled();
  });

  // ── Empty result is 200, never an error ──────────────────────────────────────

  it('MP-R8: empty array 200 when no previas exist (never error)', async () => {
    repo = makeRepo([]);
    useCase = new ListMateriasPreviasByStudentUseCase(repo as any);

    const result = await useCase.execute({ studentId: 'stu-1' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });

  // ── Cross-tenant: non-existent student → 404 ────────────────────────────────

  it('cross-tenant: student not in tenant → NotFoundError 404', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makeTenantClient(false) as any,
    );
    repo = makeRepo([]);
    useCase = new ListMateriasPreviasByStudentUseCase(repo as any);

    const result = await useCase.execute({ studentId: 'other-tenant-stu' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().constructor.name).toBe('NotFoundError');
    expect(repo.findByStudent).not.toHaveBeenCalled();
  });

  // ── Response shape ────────────────────────────────────────────────────────────

  it('returns plain-object projections with expected fields', async () => {
    const previa = makePrevia({
      studentId: 'stu-1',
      subjectId: 'subj-2',
      originAcademicYear: '2024',
      condicion: SubjectFinalGradeCondicion.LIBRE,
    });
    repo = makeRepo([previa]);
    useCase = new ListMateriasPreviasByStudentUseCase(repo as any);

    const result = await useCase.execute({ studentId: 'stu-1' });

    expect(result.isOk()).toBe(true);
    const items = result.unwrap();
    expect(items[0]).toMatchObject({
      studentId: 'stu-1',
      subjectId: 'subj-2',
      originAcademicYear: '2024',
      condicion: SubjectFinalGradeCondicion.LIBRE,
      status: MateriaPreviaStatus.PENDIENTE,
    });
  });
});
