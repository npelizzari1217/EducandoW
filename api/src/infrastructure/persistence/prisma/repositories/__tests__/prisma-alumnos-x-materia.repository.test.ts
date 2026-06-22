/**
 * PrismaAlumnosXMateriaRepository — unit tests for findByMateriaEnriched ordering.
 * Mocks TenantContext.getClient() — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAlumnosXMateriaRepository } from '../prisma-alumnos-x-materia.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

type MockRow = {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 'axm-1',
    materiaXCursoXCicloId: 'm-1',
    studentId: 's-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeClient(
  rows: MockRow[],
  students: { id: string; firstName: string; lastName: string }[],
  overrides: { deleteMany?: ReturnType<typeof vi.fn> } = {},
) {
  return {
    materiasXAlumnoXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(rows),
      deleteMany: overrides.deleteMany ?? vi.fn().mockResolvedValue({ count: 1 }),
    },
    student: { findMany: vi.fn().mockResolvedValue(students) },
  };
}

// ── T2.1: removeStudent tests ──────────────────────────────────────────────────

describe('PrismaAlumnosXMateriaRepository.removeStudent', () => {
  let repo: PrismaAlumnosXMateriaRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXMateriaRepository();
  });

  it('T2.1-A: removeStudent(id) calls deleteMany with { id } and returns void', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = makeClient([], [], { deleteMany });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    await repo.removeStudent('axm-42');

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'axm-42' } });
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it('T2.1-B: removeStudent(id) on non-existent id is idempotent — no throw (deleteMany count=0)', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const client = makeClient([], [], { deleteMany });
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    await expect(repo.removeStudent('non-existent')).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'non-existent' } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaAlumnosXMateriaRepository.findByMateriaEnriched', () => {
  let repo: PrismaAlumnosXMateriaRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXMateriaRepository();
  });

  it('orders enriched result by lastName + firstName (es)', async () => {
    // Insertion order (createdAt) is intentionally NOT alphabetical.
    const client = makeClient(
      [
        makeRow({ id: 'axm-1', studentId: 's-zarate' }),
        makeRow({ id: 'axm-2', studentId: 's-alvarez-c' }),
        makeRow({ id: 'axm-3', studentId: 's-alvarez-a' }),
      ],
      [
        { id: 's-zarate', firstName: 'Beto', lastName: 'Zárate' },
        { id: 's-alvarez-c', firstName: 'Carlos', lastName: 'Álvarez' },
        { id: 's-alvarez-a', firstName: 'Ana', lastName: 'Álvarez' },
      ],
    );
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    const result = await repo.findByMateriaEnriched('m-1');

    // Álvarez before Zárate; within Álvarez, Ana before Carlos
    expect(result.map((r) => r.studentName)).toEqual([
      'Ana Álvarez',
      'Carlos Álvarez',
      'Beto Zárate',
    ]);
  });

  it('returns empty array when no rows exist', async () => {
    const client = makeClient([], []);
    vi.mocked(TenantContext.getClient).mockReturnValue(
      client as unknown as ReturnType<typeof TenantContext.getClient>,
    );

    const result = await repo.findByMateriaEnriched('m-empty');

    expect(result).toEqual([]);
  });
});
