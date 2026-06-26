/**
 * PrismaAsistenciaGeneralRepository — generateMany unit tests (PR2, T4.1 + T4.2).
 * TDD RED → GREEN for read-merge-write transactional semantics.
 *
 * T4.1: mergeLocked + daysChanged pure helpers
 * T4.2: generateMany — General repo (mock Prisma client, no DB)
 *
 * Satisfies: GEN-1..3, REGEN-1..4, idempotency, empty-input
 * AC-03, AC-04, AC-05, AC-06
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
  PrismaAsistenciaGeneralRepository,
  mergeLocked,
  daysChanged,
} from '../prisma-asistencia-general.repository';

// ── Precomputed locked maps (domain util — already tested in PR1) ─────────────

const jan2025Map = buildLockedDayMap(2025, 1);
// jan2025: SAB=4,11,18,25 / DOM=5,12,19,26 / no X (31 days)

const feb2025Map = buildLockedDayMap(2025, 2);
// feb2025: SAB=1,8,15,22 / DOM=2,9,16,23 / X=29,30,31

const feb2024Map = buildLockedDayMap(2024, 2);
// feb2024: SAB=3,10,17,24 / DOM=4,11,18,25 / X=30,31 (day 29 exists)

// ── Client mock factory ───────────────────────────────────────────────────────

type ExistingRow = { id: string; studentId: string; days: Record<string, string> | unknown };

function makeGenerateManyClient(findManyRows: ExistingRow[] = []) {
  const txClient = {
    asistenciaXAlumnoXCursoXCiclo: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const client = {
    asistenciaXAlumnoXCursoXCiclo: {
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

// ── T4.1: mergeLocked pure helper ─────────────────────────────────────────────

describe('mergeLocked — pure helper (T4.1)', () => {
  it('{}  + lockedMap → returns only locked entries (first-gen: no existing data)', () => {
    const result = mergeLocked({}, { '4': 'SAB', '5': 'DOM' });
    expect(result).toEqual({ '4': 'SAB', '5': 'DOM' });
  });

  it('{"1":"P"} + {"4":"SAB","5":"DOM"} → hábil "1":"P" preserved (REGEN-1)', () => {
    const result = mergeLocked({ '1': 'P' }, { '4': 'SAB', '5': 'DOM' });
    expect(result).toEqual({ '1': 'P', '4': 'SAB', '5': 'DOM' });
    expect(result['1']).toBe('P'); // hábil key not overwritten
  });

  it('{"4":"SAB","1":"P"} + {"4":"SAB","5":"DOM"} → "4":"SAB" unchanged, "1":"P" preserved (REGEN-2)', () => {
    const result = mergeLocked({ '4': 'SAB', '1': 'P' }, { '4': 'SAB', '5': 'DOM' });
    expect(result['4']).toBe('SAB');
    expect(result['1']).toBe('P');
    expect(result['5']).toBe('DOM');
  });

  it('{"6":"P"} + {"6":"SAB"} → "6":"SAB" (legacy incorrect entry corrected when calendar says blocked)', () => {
    // lockedMap never has hábil days — if it has "6", that means day 6 IS a Saturday.
    // mergeLocked corrects the legacy "P" to "SAB" because locked keys "win".
    const result = mergeLocked({ '6': 'P' }, { '6': 'SAB' });
    expect(result['6']).toBe('SAB');
  });

  it('{"1":"P"} + undefined → {"1":"P"} no-op (REGEN-3: no lockedMap provided)', () => {
    const result = mergeLocked({ '1': 'P' }, undefined);
    expect(result).toEqual({ '1': 'P' });
  });
});

describe('daysChanged — pure helper', () => {
  it('returns false when objects are identical', () => {
    expect(daysChanged({ '1': 'P', '4': 'SAB' }, { '1': 'P', '4': 'SAB' })).toBe(false);
  });

  it('returns false regardless of key insertion order', () => {
    expect(daysChanged({ '1': 'P', '4': 'SAB' }, { '4': 'SAB', '1': 'P' })).toBe(false);
  });

  it('returns true when a key is missing in b', () => {
    expect(daysChanged({ '1': 'P', '4': 'SAB' }, { '1': 'P' })).toBe(true);
  });

  it('returns true when a value differs', () => {
    expect(daysChanged({ '1': 'P' }, { '1': 'A' })).toBe(true);
  });

  it('returns true when b has extra keys', () => {
    expect(daysChanged({ '1': 'P' }, { '1': 'P', '4': 'SAB' })).toBe(true);
  });
});

// ── T4.2: generateMany — General repo ────────────────────────────────────────

describe('PrismaAsistenciaGeneralRepository — generateMany read-merge-write (T4.2)', () => {
  let repo: PrismaAsistenciaGeneralRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAsistenciaGeneralRepository();
  });

  // ── Empty input ─────────────────────────────────────────────────────────────

  it('empty rows → returns { created:0, skipped:0 } without any DB call', async () => {
    const result = await repo.generateMany([]);
    expect(result).toEqual({ created: 0, skipped: 0 });
    // client is never accessed
  });

  // ── GEN-1: Jan 2025, 2 students, no existing rows ────────────────────────────

  describe('GEN-1: Jan 2025 — 2 students, no existing rows', () => {
    it('createMany called with both rows including SAB/DOM keys; no update; no X keys', async () => {
      const { client, txClient } = makeGenerateManyClient([]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const rows = [
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
        { courseCycleId: 'cc-1', studentId: 'stu-B', year: 2025, month: 1, days: jan2025Map },
      ];
      const result = await repo.generateMany(rows);

      // Returns correct counts
      expect(result).toEqual({ created: 2, skipped: 0 });

      // findMany called with correct scope+month+studentIds
      expect(client.asistenciaXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            courseCycleId: 'cc-1',
            year: 2025,
            month: 1,
            studentId: { in: ['stu-A', 'stu-B'] },
          },
        }),
      );

      // createMany called for both new rows with days = jan2025Map
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ studentId: 'stu-A', days: jan2025Map }),
          expect.objectContaining({ studentId: 'stu-B', days: jan2025Map }),
        ],
        skipDuplicates: true,
      });

      // No update calls
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.update).not.toHaveBeenCalled();

      // Verify locked map content for Jan 2025
      expect(jan2025Map['4']).toBe('SAB');
      expect(jan2025Map['5']).toBe('DOM');
      expect(jan2025Map['11']).toBe('SAB');
      expect(jan2025Map['12']).toBe('DOM');
      expect(jan2025Map).not.toHaveProperty('1'); // Monday — hábil
      expect(jan2025Map).not.toHaveProperty('6'); // Monday — hábil
      expect(Object.values(jan2025Map)).not.toContain('X'); // Jan has 31 days
    });
  });

  // ── GEN-2: Feb 2025, non-leap ─────────────────────────────────────────────

  describe('GEN-2: Feb 2025 — 1 student, no existing rows', () => {
    it('createMany row includes X for days 29, 30, 31; no key "28"', async () => {
      const { client, txClient } = makeGenerateManyClient([]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 2, days: feb2025Map },
      ]);

      expect(txClient.asistenciaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ days: feb2025Map })],
        skipDuplicates: true,
      });

      // Verify locked map for Feb 2025
      expect(feb2025Map['29']).toBe('X');
      expect(feb2025Map['30']).toBe('X');
      expect(feb2025Map['31']).toBe('X');
      expect(feb2025Map).not.toHaveProperty('28'); // day 28 = Friday, hábil
    });
  });

  // ── GEN-3: Feb 2024, leap ────────────────────────────────────────────────

  describe('GEN-3: Feb 2024 — 1 student, no existing rows (leap year)', () => {
    it('createMany row has X for 30, 31; no key "29" (day 29 exists in 2024)', async () => {
      const { client, txClient } = makeGenerateManyClient([]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2024, month: 2, days: feb2024Map },
      ]);

      expect(txClient.asistenciaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ days: feb2024Map })],
        skipDuplicates: true,
      });

      expect(feb2024Map['30']).toBe('X');
      expect(feb2024Map['31']).toBe('X');
      expect(feb2024Map).not.toHaveProperty('29'); // day 29 exists in 2024
    });
  });

  // ── REGEN-1: Jan 2025, existing row {"1":"P"} ────────────────────────────

  describe('REGEN-1: Jan 2025 — existing row {"1":"P"}, hábil entry preserved', () => {
    it('update called with merged days; "1":"P" preserved; all SAB/DOM added', async () => {
      const existingRow = makeRow('row-1', 'stu-A', { '1': 'P' });
      const { client, txClient } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
      ]);

      // No createMany (stu-A already exists)
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.createMany).not.toHaveBeenCalled();

      // update called with merged days
      const expectedMerged: Record<string, string> = { '1': 'P', ...jan2025Map };
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: { days: expectedMerged, updatedAt: expect.any(Date) },
      });

      // hábil key "1":"P" is preserved in merged result
      expect(expectedMerged['1']).toBe('P');
      // SAB/DOM are present
      expect(expectedMerged['4']).toBe('SAB');
      expect(expectedMerged['5']).toBe('DOM');
    });
  });

  // ── REGEN-2: existing {"4":"SAB","1":"P"} ────────────────────────────────

  describe('REGEN-2: Jan 2025 — existing {"4":"SAB","1":"P"}, no duplicates or overwrites', () => {
    it('update called; "4":"SAB" unchanged; "1":"P" unchanged; remaining SAB/DOM added', async () => {
      const existingRow = makeRow('row-1', 'stu-A', { '4': 'SAB', '1': 'P' });
      const { client, txClient } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
      ]);

      const updateCall = txClient.asistenciaXAlumnoXCursoXCiclo.update.mock.calls[0][0];
      const mergedDays = updateCall.data.days as Record<string, string>;

      expect(mergedDays['4']).toBe('SAB'); // unchanged
      expect(mergedDays['1']).toBe('P');   // unchanged (hábil key preserved)
      expect(mergedDays['5']).toBe('DOM'); // added
      expect(mergedDays['11']).toBe('SAB'); // added
    });
  });

  // ── REGEN-3: existing {"6":"P"} for Jan 2025 (day 6 is Monday — hábil) ───

  describe('REGEN-3: Jan 2025 — existing {"6":"P"} (day 6 = Monday), hábil key not overwritten', () => {
    it('update called; "6":"P" preserved (lockedMap has no key "6" for Jan 2025)', async () => {
      // In Jan 2025, day 6 is Monday (hábil) → lockedMap does NOT contain "6"
      const existingRow = makeRow('row-1', 'stu-A', { '6': 'P' });
      const { client, txClient } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
      ]);

      const updateCall = txClient.asistenciaXAlumnoXCursoXCiclo.update.mock.calls[0][0];
      const mergedDays = updateCall.data.days as Record<string, string>;

      // "6":"P" is preserved because lockedMap has no key "6"
      expect(mergedDays['6']).toBe('P');
      // SAB/DOM still added
      expect(mergedDays['4']).toBe('SAB');
      expect(mergedDays['5']).toBe('DOM');
      // "6" NOT set to SAB/DOM/X
      expect(mergedDays['6']).not.toBe('SAB');
      expect(mergedDays['6']).not.toBe('DOM');
      expect(mergedDays['6']).not.toBe('X');
    });
  });

  // ── REGEN-4: mixed — stu-A has existing row, stu-B does not ──────────────

  describe('REGEN-4: Feb 2025 — mixed: stu-A exists, stu-B is new', () => {
    it('createMany for stu-B with full lockedMap; update for stu-A with merge', async () => {
      const existingRowA = makeRow('row-A', 'stu-A', { '3': 'P' });
      const { client, txClient } = makeGenerateManyClient([existingRowA]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 2, days: feb2025Map },
        { courseCycleId: 'cc-1', studentId: 'stu-B', year: 2025, month: 2, days: feb2025Map },
      ]);

      // createMany called for stu-B (new student)
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ studentId: 'stu-B', days: feb2025Map })],
        skipDuplicates: true,
      });

      // update called for stu-A (existing) with merged days
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.update).toHaveBeenCalledWith({
        where: { id: 'row-A' },
        data: { days: { '3': 'P', ...feb2025Map }, updatedAt: expect.any(Date) },
      });

      // stu-B row has full locked map (including X entries for Feb 2025)
      const createManyCall = txClient.asistenciaXAlumnoXCursoXCiclo.createMany.mock.calls[0][0];
      const stuBDays = createManyCall.data[0].days as Record<string, string>;
      expect(stuBDays['29']).toBe('X');
      expect(stuBDays['30']).toBe('X');
      expect(stuBDays['31']).toBe('X');
    });
  });

  // ── Idempotency: no update when merged === existing ───────────────────────

  describe('Idempotency: when merged days === existing days, update is NOT called', () => {
    it('skip update if existing already has the full locked map', async () => {
      // Existing row already has the full jan2025Map
      const existingRow = makeRow('row-1', 'stu-A', jan2025Map);
      const { client, txClient } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
      ]);

      // merged = { ...jan2025Map, ...jan2025Map } = jan2025Map → no change
      expect(txClient.asistenciaXAlumnoXCursoXCiclo.update).not.toHaveBeenCalled();
    });

    it('returns { created:0, skipped:1 } when the single row already existed', async () => {
      const existingRow = makeRow('row-1', 'stu-A', jan2025Map);
      const { client } = makeGenerateManyClient([existingRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.generateMany([
        { courseCycleId: 'cc-1', studentId: 'stu-A', year: 2025, month: 1, days: jan2025Map },
      ]);

      expect(result).toEqual({ created: 0, skipped: 1 });
    });
  });
});
