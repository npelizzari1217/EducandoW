/**
 * PrismaAsistenciaMateriaRepository — generateMany unit tests (PR2, T4.3).
 * TDD RED → GREEN for read-merge-write transactional semantics.
 *
 * T4.3: generateMany — Materia repo (mock Prisma client, no DB)
 * Natural key: materiaXCursoXCicloId
 *
 * Satisfies: GEN-4, REGEN-4 (materia variant)
 * AC-03, AC-04, AC-06
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLockedDayMap } from '@educandow/domain';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

import { TenantContext } from '../../../../auth/tenant.context';
import {
  PrismaAsistenciaMateriaRepository,
  mergeLocked as mergeLockedMateria,
  daysChanged as daysChangedMateria,
} from '../prisma-asistencia-materia.repository';

// ── Precomputed locked maps ───────────────────────────────────────────────────

const apr2025Map = buildLockedDayMap(2025, 4);
// apr2025: SAB=5,12,19,26 / DOM=6,13,20,27 / X=31

const feb2025Map = buildLockedDayMap(2025, 2);
// feb2025: X=29,30,31

// ── Client mock factory ───────────────────────────────────────────────────────

type ExistingRow = { id: string; studentId: string; days: Record<string, string> | unknown };

function makeGenerateManyClient(findManyRows: ExistingRow[] = []) {
  const txClient = {
    asistenciaXMateriaXAlumnoXCursoXCiclo: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const client = {
    asistenciaXMateriaXAlumnoXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(findManyRows),
    },
    $transaction: vi.fn().mockImplementation(
      async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
    ),
  };

  return { client, txClient };
}

function makeRow(id: string, studentId: string, days: Record<string, string>): ExistingRow {
  return { id, studentId, days };
}

// ── T4.3: generateMany — Materia repo ────────────────────────────────────────

describe('PrismaAsistenciaMateriaRepository — generateMany read-merge-write (T4.3)', () => {
  let repo: PrismaAsistenciaMateriaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAsistenciaMateriaRepository();
  });

  // ── Empty input ─────────────────────────────────────────────────────────────

  it('empty rows → returns { created:0, skipped:0 } without any DB call', async () => {
    const result = await repo.generateMany([]);
    expect(result).toEqual({ created: 0, skipped: 0 });
  });

  // ── GEN-4: Apr 2025, 1 student, subject S, no existing rows ─────────────────

  describe('GEN-4: Apr 2025 — 1 student, subject S, no existing rows', () => {
    it('createMany with days["31"]="X"; no key "30" (day 30 exists in April)', async () => {
      const { client, txClient } = makeGenerateManyClient([]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        {
          materiaXCursoXCicloId: 'mx-1',
          studentId: 'stu-A',
          year: 2025,
          month: 4,
          days: apr2025Map,
        },
      ]);

      expect(txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            materiaXCursoXCicloId: 'mx-1',
            studentId: 'stu-A',
            days: apr2025Map,
          }),
        ],
        skipDuplicates: true,
      });

      expect(txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.update).not.toHaveBeenCalled();

      // Verify Apr 2025 locked map
      expect(apr2025Map['31']).toBe('X');     // non-existent day
      expect(apr2025Map).not.toHaveProperty('30'); // day 30 exists in April
      expect(apr2025Map['5']).toBe('SAB');    // first Saturday
      expect(apr2025Map['6']).toBe('DOM');    // first Sunday
    });

    it('findMany uses materiaXCursoXCicloId as scope (not courseCycleId)', async () => {
      const { client } = makeGenerateManyClient([]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        {
          materiaXCursoXCicloId: 'mx-1',
          studentId: 'stu-A',
          year: 2025,
          month: 4,
          days: apr2025Map,
        },
      ]);

      expect(client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            materiaXCursoXCicloId: 'mx-1',
          }),
        }),
      );
    });
  });

  // ── REGEN-4 (materia): new student on re-gen gets full lockedMap ─────────────

  describe('REGEN-4 (materia variant): new student added after initial generation', () => {
    it('createMany for new student with full lockedMap; update for existing with merge', async () => {
      const existingRowA = makeRow('row-A', 'stu-A', { '2': 'P' });
      const { client, txClient } = makeGenerateManyClient([existingRowA]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        {
          materiaXCursoXCicloId: 'mx-1',
          studentId: 'stu-A',
          year: 2025,
          month: 2,
          days: feb2025Map,
        },
        {
          materiaXCursoXCicloId: 'mx-1',
          studentId: 'stu-B',
          year: 2025,
          month: 2,
          days: feb2025Map,
        },
      ]);

      // stu-B (new) gets createMany with full locked map
      expect(txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ studentId: 'stu-B', days: feb2025Map })],
        skipDuplicates: true,
      });

      // stu-B's row has X entries for Feb 2025
      const createManyData = txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.createMany.mock
        .calls[0][0].data[0].days as Record<string, string>;
      expect(createManyData['29']).toBe('X');
      expect(createManyData['30']).toBe('X');
      expect(createManyData['31']).toBe('X');

      // stu-A (existing) gets update with merged days (preserving "2":"P")
      expect(txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.update).toHaveBeenCalledWith({
        where: { id: 'row-A' },
        data: { days: { '2': 'P', ...feb2025Map }, updatedAt: expect.any(Date) },
      });
    });
  });

  // ── Idempotency: no update when merged === existing ───────────────────────

  describe('Idempotency: update skipped when days already up-to-date', () => {
    it('no update when existing already has the full locked map for Apr 2025', async () => {
      const existingRow = makeRow('row-1', 'stu-A', apr2025Map);
      const { client, txClient } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        {
          materiaXCursoXCicloId: 'mx-1',
          studentId: 'stu-A',
          year: 2025,
          month: 4,
          days: apr2025Map,
        },
      ]);

      expect(txClient.asistenciaXMateriaXAlumnoXCursoXCiclo.update).not.toHaveBeenCalled();
    });
  });

  // ── Verify mergeLocked and daysChanged are also exported from materia repo ──

  describe('mergeLocked and daysChanged exported from materia repo (module symmetry)', () => {
    it('mergeLocked is a pure function in materia repo', () => {
      expect(mergeLockedMateria({ '1': 'P' }, { '4': 'SAB' })).toEqual({
        '1': 'P',
        '4': 'SAB',
      });
    });

    it('daysChanged works correctly in materia repo', () => {
      expect(daysChangedMateria({ '1': 'P' }, { '1': 'P' })).toBe(false);
      expect(daysChangedMateria({ '1': 'P' }, { '1': 'A' })).toBe(true);
    });
  });
});
