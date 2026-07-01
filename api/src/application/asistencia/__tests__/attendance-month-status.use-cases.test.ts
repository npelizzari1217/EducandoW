/**
 * GetAttendanceMonthStatusUseCase / OpenAttendanceMonthUseCase /
 * CloseAttendanceMonthUseCase — unit tests (TDD RED, PR-3b).
 *
 * Covers:
 *   AMS-T01: Get — no row exists → default OPEN (closed: false, closedAt/closedBy null)
 *   AMS-T02: Get — row exists closed → returns closed:true + attribution
 *   AMS-T03: Get — CourseCycle does not exist → NotFoundError
 *   AMS-T04: Close — no row exists → creates + closes it (upsert called with closed entity)
 *   AMS-T05: Close — row exists open → closes it, sets closedAt/closedBy
 *   AMS-T06: Open — row exists closed → reopens it, clears closedAt/closedBy
 *   AMS-T07: Open — no row exists → creates it already-open (idempotent, upsert called)
 *   AMS-T08: Close/Open — CourseCycle does not exist → NotFoundError
 *
 * Pattern: mocked AttendanceMonthStatusRepository + TenantContext, no NestJS, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NotFoundError, AttendanceMonthStatus } from '@educandow/domain';
import type { AttendanceMonthStatusRepository } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GetAttendanceMonthStatusUseCase: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let OpenAttendanceMonthUseCase: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CloseAttendanceMonthUseCase: any;

beforeAll(async () => {
  const mod = await import('../attendance-month-status.use-cases');
  GetAttendanceMonthStatusUseCase = mod.GetAttendanceMonthStatusUseCase;
  OpenAttendanceMonthUseCase = mod.OpenAttendanceMonthUseCase;
  CloseAttendanceMonthUseCase = mod.CloseAttendanceMonthUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';
const YEAR = 2026;
const MONTH = 6;
const USER_ID = 'user-1';

function makeClosedStatus(): AttendanceMonthStatus {
  const status = AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH });
  status.close(USER_ID);
  return status;
}

function makeOpenStatus(): AttendanceMonthStatus {
  return AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH });
}

function makeRepo(overrides: Partial<AttendanceMonthStatusRepository> = {}): AttendanceMonthStatusRepository {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findLatestBefore: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockTenantClient(ccExists = true) {
  const client = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(ccExists ? { uuid: CC_ID } : null),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(client as never);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GetAttendanceMonthStatusUseCase ──────────────────────────────────────────

describe('GetAttendanceMonthStatusUseCase', () => {
  describe('AMS-T01: no row exists → default OPEN', () => {
    it('returns closed:false with null attribution', async () => {
      mockTenantClient();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const uc = new GetAttendanceMonthStatusUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH });

      expect(result).toEqual({
        courseCycleId: CC_ID,
        year: YEAR,
        month: MONTH,
        closed: false,
        closedAt: null,
        closedBy: null,
      });
    });
  });

  describe('AMS-T02: row exists closed → returns closed:true + attribution', () => {
    it('maps entity to result', async () => {
      mockTenantClient();
      const closed = makeClosedStatus();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(closed) });
      const uc = new GetAttendanceMonthStatusUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH });

      expect(result.closed).toBe(true);
      expect(result.closedBy).toBe(USER_ID);
      expect(result.closedAt).toBeInstanceOf(Date);
    });
  });

  describe('AMS-T03: CourseCycle does not exist → NotFoundError', () => {
    it('throws NotFoundError', async () => {
      mockTenantClient(false);
      const repo = makeRepo();
      const uc = new GetAttendanceMonthStatusUseCase(repo);

      await expect(
        uc.execute({ courseCycleId: 'missing-cc', year: YEAR, month: MONTH }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});

// ── CloseAttendanceMonthUseCase ───────────────────────────────────────────────

describe('CloseAttendanceMonthUseCase', () => {
  describe('AMS-T04: no row exists → creates + closes it', () => {
    it('calls upsert with a closed entity', async () => {
      mockTenantClient();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const uc = new CloseAttendanceMonthUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: USER_ID });

      expect(repo.upsert).toHaveBeenCalledTimes(1);
      const upserted = vi.mocked(repo.upsert).mock.calls[0][0] as AttendanceMonthStatus;
      expect(upserted.isClosed()).toBe(true);
      expect(result.closed).toBe(true);
      expect(result.closedBy).toBe(USER_ID);
    });
  });

  describe('AMS-T05: row exists open → closes it', () => {
    it('sets closedAt/closedBy and persists', async () => {
      mockTenantClient();
      const open = makeOpenStatus();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(open) });
      const uc = new CloseAttendanceMonthUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: USER_ID });

      expect(result.closed).toBe(true);
      expect(result.closedBy).toBe(USER_ID);
      expect(repo.upsert).toHaveBeenCalledWith(open);
    });
  });

  describe('AMS-T08a: CourseCycle does not exist → NotFoundError', () => {
    it('throws NotFoundError without touching the repo', async () => {
      mockTenantClient(false);
      const repo = makeRepo();
      const uc = new CloseAttendanceMonthUseCase(repo);

      await expect(
        uc.execute({ courseCycleId: 'missing-cc', year: YEAR, month: MONTH, userId: USER_ID }),
      ).rejects.toThrow(NotFoundError);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });
});

// ── OpenAttendanceMonthUseCase ────────────────────────────────────────────────

describe('OpenAttendanceMonthUseCase', () => {
  describe('AMS-T06: row exists closed → reopens it', () => {
    it('clears closedAt/closedBy and persists', async () => {
      mockTenantClient();
      const closed = makeClosedStatus();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(closed) });
      const uc = new OpenAttendanceMonthUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: USER_ID });

      expect(result.closed).toBe(false);
      expect(result.closedAt).toBeNull();
      expect(result.closedBy).toBeNull();
      expect(repo.upsert).toHaveBeenCalledWith(closed);
    });
  });

  describe('AMS-T07: no row exists → creates it already-open (idempotent)', () => {
    it('calls upsert with an open entity', async () => {
      mockTenantClient();
      const repo = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const uc = new OpenAttendanceMonthUseCase(repo);

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: USER_ID });

      expect(repo.upsert).toHaveBeenCalledTimes(1);
      expect(result.closed).toBe(false);
    });
  });

  describe('AMS-T08b: CourseCycle does not exist → NotFoundError', () => {
    it('throws NotFoundError without touching the repo', async () => {
      mockTenantClient(false);
      const repo = makeRepo();
      const uc = new OpenAttendanceMonthUseCase(repo);

      await expect(
        uc.execute({ courseCycleId: 'missing-cc', year: YEAR, month: MONTH, userId: USER_ID }),
      ).rejects.toThrow(NotFoundError);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });
});
