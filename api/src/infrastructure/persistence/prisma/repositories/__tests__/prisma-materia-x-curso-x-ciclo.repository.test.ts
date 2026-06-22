/**
 * PrismaMateriaXCursoXCicloRepository — unit tests for esOptativa flag plumbing.
 * Mocks TenantContext.getClient() — no real DB required.
 *
 * Covers MGC-R7 (upsertMany persists flag), MGC-R10 (setEsOptativa).
 * Task T1.8 / T1.9.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaMateriaXCursoXCicloRepository } from '../prisma-materia-x-curso-x-ciclo.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

// ── Types / helpers ────────────────────────────────────────────────────────────

type MockRow = {
  id: string;
  courseCycleId: string;
  subjectId: string;
  studyPlanSubjectId: string | null;
  esOptativa: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 'mxcc-1',
    courseCycleId: 'cc-1',
    subjectId: 'sub-1',
    studyPlanSubjectId: null,
    esOptativa: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeClient(overrides: {
  createMany?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    materiaXCursoXCiclo: {
      createMany: overrides.createMany ?? vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
      update: overrides.update ?? vi.fn().mockResolvedValue(makeRow()),
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PrismaMateriaXCursoXCicloRepository — esOptativa flag', () => {
  let repo: PrismaMateriaXCursoXCicloRepository;

  beforeEach(() => {
    repo = new PrismaMateriaXCursoXCicloRepository();
  });

  // T1.8-A: upsertMany without esOptativa → row defaults to false; toDomain returns false
  it('upsertMany without esOptativa → createMany called with esOptativa=false', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = makeClient({ createMany });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    await repo.upsertMany([
      { courseCycleId: 'cc-1', subjectId: 'sub-1', studyPlanSubjectId: 'sps-1' },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ courseCycleId: 'cc-1', subjectId: 'sub-1', studyPlanSubjectId: 'sps-1', esOptativa: false }],
      skipDuplicates: true,
    });
  });

  // T1.8-B: upsertMany with esOptativa: true → row has true; toDomain returns true
  it('upsertMany with esOptativa: true → createMany called with esOptativa=true', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = makeClient({ createMany });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    await repo.upsertMany([
      { courseCycleId: 'cc-1', subjectId: 'sub-1', esOptativa: true },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ courseCycleId: 'cc-1', subjectId: 'sub-1', studyPlanSubjectId: null, esOptativa: true }],
      skipDuplicates: true,
    });
  });

  // T1.8-C: setEsOptativa(id, true) → updates row; returns domain entity with esOptativa=true
  it('setEsOptativa(id, true) → calls update with esOptativa=true and returns entity', async () => {
    const updatedRow = makeRow({ id: 'mxcc-1', esOptativa: true });
    const update = vi.fn().mockResolvedValue(updatedRow);
    const client = makeClient({ update });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    const result = await repo.setEsOptativa('mxcc-1', true);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'mxcc-1' },
      data: { esOptativa: true },
    });
    expect(result.esOptativa).toBe(true);
    expect(result.id).toBe('mxcc-1');
  });

  // T1.8-D: setEsOptativa(id, false) → flips back; returns entity with esOptativa=false
  it('setEsOptativa(id, false) → calls update with esOptativa=false and returns entity', async () => {
    const updatedRow = makeRow({ id: 'mxcc-1', esOptativa: false });
    const update = vi.fn().mockResolvedValue(updatedRow);
    const client = makeClient({ update });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    const result = await repo.setEsOptativa('mxcc-1', false);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'mxcc-1' },
      data: { esOptativa: false },
    });
    expect(result.esOptativa).toBe(false);
  });

  // T1.8-E: toDomain round-trips esOptativa from row
  it('findById returns domain entity with esOptativa from the row', async () => {
    const row = makeRow({ esOptativa: true });
    const findUnique = vi.fn().mockResolvedValue(row);
    const client = makeClient({ findUnique });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    const result = await repo.findById('mxcc-1');

    expect(result).not.toBeNull();
    expect(result!.esOptativa).toBe(true);
  });
});
