/**
 * PrismaAttendanceMonthStatusRepository — unit tests (TDD RED, PR-3b).
 *
 * Covers:
 *   REPO-AMS-T01: findOne — maps a found row to the domain entity (status CLOSED → closed:true)
 *   REPO-AMS-T02: findOne — returns null when no row exists (default-open, no query error)
 *   REPO-AMS-T03: findLatestBefore — queries with monthOrdinal ordering, excludes the target month
 *   REPO-AMS-T04: findLatestBefore — returns null when no earlier row exists
 *   REPO-AMS-T05: upsert — creates when no row exists (create with OPEN defaults if entity is open)
 *   REPO-AMS-T06: upsert — updates existing row (status/closedAt/closedBy) via Prisma upsert
 *   REPO-AMS-T07: upsert — maps closed entity to status: 'CLOSED' + closedAt/closedBy
 *   REPO-AMS-T08: upsert — maps open entity to status: 'OPEN' + closedAt/closedBy null
 *
 * Pattern: mock TenantContext.getClient(), no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceMonthStatus, Id } from '@educandow/domain';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

import { TenantContext } from '../../../../auth/tenant.context';
import { PrismaAttendanceMonthStatusRepository } from '../prisma-attendance-month-status.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    courseCycleId: CC_ID,
    year: 2026,
    month: 6,
    status: 'OPEN',
    closedAt: null,
    closedBy: null,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function makeClient() {
  return {
    attendanceMonthStatus: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

function makeClosedEntity(): AttendanceMonthStatus {
  const status = AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: 2026, month: 6 });
  status.close('user-secretario');
  return status;
}

function makeOpenEntity(): AttendanceMonthStatus {
  return AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: 2026, month: 6 });
}

function makeReconstructedOpenEntity(): AttendanceMonthStatus {
  return AttendanceMonthStatus.reconstruct({
    id: Id.reconstruct('row-1'),
    courseCycleId: CC_ID,
    year: 2026,
    month: 6,
    closed: false,
    closedAt: null,
    closedBy: null,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PrismaAttendanceMonthStatusRepository', () => {
  let repo: PrismaAttendanceMonthStatusRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAttendanceMonthStatusRepository();
  });

  describe('REPO-AMS-T01: findOne — maps a found row to the domain entity', () => {
    it('returns AttendanceMonthStatus with closed:true when status is CLOSED', async () => {
      const client = makeClient();
      const closedAt = new Date('2026-06-15');
      vi.mocked(client.attendanceMonthStatus.findUnique).mockResolvedValue(
        makePrismaRow({ status: 'CLOSED', closedAt, closedBy: 'user-1' }),
      );
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findOne(CC_ID, 2026, 6);

      expect(client.attendanceMonthStatus.findUnique).toHaveBeenCalledWith({
        where: { courseCycleId_year_month: { courseCycleId: CC_ID, year: 2026, month: 6 } },
      });
      expect(result).toBeInstanceOf(AttendanceMonthStatus);
      expect(result?.isClosed()).toBe(true);
      expect(result?.closedBy).toBe('user-1');
      expect(result?.closedAt).toEqual(closedAt);
    });
  });

  describe('REPO-AMS-T02: findOne — returns null when no row exists', () => {
    it('returns null (default-open, no row)', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.findUnique).mockResolvedValue(null);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findOne(CC_ID, 2026, 6);

      expect(result).toBeNull();
    });
  });

  describe('REPO-AMS-T03: findLatestBefore — queries with correct ordering', () => {
    it('queries rows for courseCycleId ordered by year/month desc and picks the first strictly-before match', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.findFirst).mockResolvedValue(
        makePrismaRow({ year: 2026, month: 5, status: 'CLOSED' }),
      );
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findLatestBefore(CC_ID, 2026, 6);

      expect(client.attendanceMonthStatus.findFirst).toHaveBeenCalledWith({
        where: {
          courseCycleId: CC_ID,
          OR: [{ year: { lt: 2026 } }, { year: 2026, month: { lt: 6 } }],
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      expect(result).toBeInstanceOf(AttendanceMonthStatus);
      expect(result?.month).toBe(5);
    });

    it('handles year rollover — previous month of Jan is Dec of prior year', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.findFirst).mockResolvedValue(
        makePrismaRow({ year: 2025, month: 12, status: 'CLOSED' }),
      );
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.findLatestBefore(CC_ID, 2026, 1);

      expect(client.attendanceMonthStatus.findFirst).toHaveBeenCalledWith({
        where: {
          courseCycleId: CC_ID,
          OR: [{ year: { lt: 2026 } }, { year: 2026, month: { lt: 1 } }],
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    });
  });

  describe('REPO-AMS-T04: findLatestBefore — returns null when no earlier row exists', () => {
    it('returns null (first-month exemption)', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.findFirst).mockResolvedValue(null);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findLatestBefore(CC_ID, 2026, 1);

      expect(result).toBeNull();
    });
  });

  describe('REPO-AMS-T05/T06: upsert — delegates to Prisma upsert (create-or-update)', () => {
    it('calls prisma upsert with correct where/create/update payload for a closed entity', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.upsert).mockResolvedValue(makePrismaRow({ status: 'CLOSED' }));
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const entity = makeClosedEntity();
      await repo.upsert(entity);

      expect(client.attendanceMonthStatus.upsert).toHaveBeenCalledWith({
        where: { courseCycleId_year_month: { courseCycleId: CC_ID, year: 2026, month: 6 } },
        create: {
          courseCycleId: CC_ID,
          year: 2026,
          month: 6,
          status: 'CLOSED',
          closedAt: entity.closedAt,
          closedBy: entity.closedBy,
        },
        update: {
          status: 'CLOSED',
          closedAt: entity.closedAt,
          closedBy: entity.closedBy,
        },
      });
    });
  });

  describe('REPO-AMS-T07: upsert — maps a closed entity to status CLOSED + attribution', () => {
    it('passes non-null closedAt/closedBy through', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.upsert).mockResolvedValue(makePrismaRow({ status: 'CLOSED' }));
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const entity = makeClosedEntity();
      await repo.upsert(entity);

      const call = client.attendanceMonthStatus.upsert.mock.calls[0][0];
      expect(call.create.status).toBe('CLOSED');
      expect(call.create.closedBy).toBe('user-secretario');
      expect(call.create.closedAt).toBeInstanceOf(Date);
    });
  });

  describe('REPO-AMS-T08: upsert — maps an open entity to status OPEN + null attribution', () => {
    it('passes null closedAt/closedBy through for a freshly-created open entity', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.upsert).mockResolvedValue(makePrismaRow());
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const entity = makeOpenEntity();
      await repo.upsert(entity);

      expect(client.attendanceMonthStatus.upsert).toHaveBeenCalledWith({
        where: { courseCycleId_year_month: { courseCycleId: CC_ID, year: 2026, month: 6 } },
        create: {
          courseCycleId: CC_ID,
          year: 2026,
          month: 6,
          status: 'OPEN',
          closedAt: null,
          closedBy: null,
        },
        update: {
          status: 'OPEN',
          closedAt: null,
          closedBy: null,
        },
      });
    });

    it('also works for a reconstructed (previously-persisted) open entity', async () => {
      const client = makeClient();
      vi.mocked(client.attendanceMonthStatus.upsert).mockResolvedValue(makePrismaRow());
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const entity = makeReconstructedOpenEntity();
      await repo.upsert(entity);

      expect(client.attendanceMonthStatus.upsert).toHaveBeenCalledOnce();
    });
  });
});
