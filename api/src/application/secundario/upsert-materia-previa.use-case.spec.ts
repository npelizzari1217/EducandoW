/**
 * PR4-T7 [RED] — UpsertMateriaPreviaUseCase tests.
 * Specs: MP-R1..MP-R7, D2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertMateriaPreviaUseCase } from './upsert-materia-previa.use-case';
import { SubjectFinalGradeCondicion, MateriaPreviaStatus } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<{
  findByStudentAndKey: ReturnType<typeof vi.fn>;
  saveMany: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    findByStudent: vi.fn().mockResolvedValue([]),
    findByStudentAndAcademicYear: vi.fn().mockResolvedValue([]),
    saveMany: overrides.saveMany ?? vi.fn().mockResolvedValue(undefined),
  };
}

function makeTenantClient(options: {
  studentExists?: boolean;
  subjectExists?: boolean;
} = {}) {
  const { studentExists = true, subjectExists = true } = options;
  return {
    student: {
      findUnique: vi.fn().mockResolvedValue(studentExists ? { id: 'stu-1' } : null),
    },
    subject: {
      findUnique: vi.fn().mockResolvedValue(subjectExists ? { id: 'subj-1' } : null),
    },
  };
}

const VALID_INPUT = {
  studentId: 'stu-1',
  subjectId: 'subj-1',
  originAcademicYear: '2024',
  condicion: SubjectFinalGradeCondicion.PREVIA,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UpsertMateriaPreviaUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('UpsertMateriaPreviaUseCase', () => {
  let useCase: UpsertMateriaPreviaUseCase;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpsertMateriaPreviaUseCase(repo as any);
    const client = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);
  });

  // ── Happy path: valid condicion values ──────────────────────────────────────

  it('MP-R1: valid condicion=PREVIA → Ok result', async () => {
    const result = await useCase.execute(VALID_INPUT);

    expect(result.isOk()).toBe(true);
    expect(repo.saveMany).toHaveBeenCalledOnce();
  });

  it('MP-R2: valid condicion=LIBRE → Ok result', async () => {
    const input = { ...VALID_INPUT, condicion: SubjectFinalGradeCondicion.LIBRE };

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    expect(repo.saveMany).toHaveBeenCalledOnce();
  });

  // ── Condicion=REGULAR → ValidationError 400 ─────────────────────────────────

  it('MP-R3: condicion=REGULAR → ValidationError (domain invariant)', async () => {
    const input = { ...VALID_INPUT, condicion: SubjectFinalGradeCondicion.REGULAR };

    const result = await useCase.execute(input);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.constructor.name).toBe('ValidationError');
    expect(repo.saveMany).not.toHaveBeenCalled();
  });

  // ── Non-existent references → 404 ────────────────────────────────────────────

  it('MP-R4: non-existent studentId → NotFoundError 404', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makeTenantClient({ studentExists: false }) as any,
    );

    const result = await useCase.execute(VALID_INPUT);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.constructor.name).toBe('NotFoundError');
    expect(repo.saveMany).not.toHaveBeenCalled();
  });

  it('MP-R5: non-existent subjectId → NotFoundError 404', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makeTenantClient({ subjectExists: false }) as any,
    );

    const result = await useCase.execute(VALID_INPUT);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.constructor.name).toBe('NotFoundError');
    expect(repo.saveMany).not.toHaveBeenCalled();
  });

  // ── Cross-tenant isolation ────────────────────────────────────────────────────

  it('cross-tenant: student from different tenant → NotFoundError (TenantContext scopes query)', async () => {
    // The tenant Prisma client only sees its own tenant's students.
    // A student from another tenant appears as "not found".
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makeTenantClient({ studentExists: false }) as any,
    );

    const result = await useCase.execute({ ...VALID_INPUT, studentId: 'other-tenant-student' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().constructor.name).toBe('NotFoundError');
  });

  // ── Upsert semantics ──────────────────────────────────────────────────────────

  it('MP-R6: second call with same key (studentId+subjectId+year) → saveMany called again (upsert)', async () => {
    await useCase.execute(VALID_INPUT);
    const result = await useCase.execute({ ...VALID_INPUT, condicion: SubjectFinalGradeCondicion.LIBRE });

    expect(result.isOk()).toBe(true);
    expect(repo.saveMany).toHaveBeenCalledTimes(2);
  });

  // ── Resolve flow ──────────────────────────────────────────────────────────────

  it('MP-R7: saved entity has status PENDIENTE initially', async () => {
    await useCase.execute(VALID_INPUT);

    const savedItems: any[] = repo.saveMany.mock.calls[0][0];
    expect(savedItems).toHaveLength(1);
    expect(savedItems[0].status).toBe(MateriaPreviaStatus.PENDIENTE);
    expect(savedItems[0].condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
  });
});
