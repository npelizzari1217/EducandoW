/**
 * AppExceptionFilter — unit tests (TDD RED, T7.1).
 *
 * Covers:
 *   FILTER-1: DayNotAssignableError → HTTP 422, body { error: { status: 422, code: "DAY_NOT_ASSIGNABLE", message } }
 *   FILTER-2: StatusNotAssignableError → HTTP 400, body { error: { status: 400, code: "STATUS_NOT_ASSIGNABLE", message } }
 *   FILTER-3: error.status is still present for all domain errors (additive, not rename)
 *   FILTER-4: Non-domain HttpException → error.code is absent/undefined (no regression)
 *   FILTER-5: Existing domain error (e.g., NOT_FOUND) → code appears in error.code
 *   FILTER-6: MonthClosedError / PreviousMonthOpenError → HTTP 409 (PR-3b)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  DayNotAssignableError,
  StatusNotAssignableError,
  NotFoundError,
  MonthClosedError,
  PreviousMonthOpenError,
} from '@educandow/domain';
import type { ArgumentsHost } from '@nestjs/common';

// Suppress logger output during tests (filter logs 5xx internally)
vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppExceptionFilter: any;
beforeEach(async () => {
  const mod = await import('../exception.filter');
  AppExceptionFilter = mod.AppExceptionFilter;
  vi.clearAllMocks();
});

// ── Mock host factory ─────────────────────────────────────────────────────────

function makeMockHost() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  const response = { status: statusFn };
  const request = { method: 'GET', url: '/test' };
  const host = {
    switchToHttp: vi.fn().mockReturnValue({
      getResponse: vi.fn().mockReturnValue(response),
      getRequest: vi.fn().mockReturnValue(request),
    }),
  } as unknown as ArgumentsHost;
  return { host, statusFn, jsonFn };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppExceptionFilter', () => {
  describe('FILTER-1: DayNotAssignableError → HTTP 422 with code "DAY_NOT_ASSIGNABLE"', () => {
    it('maps DayNotAssignableError to 422 with code and message in envelope', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new DayNotAssignableError('day 4 is a Saturday');

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(422);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { status: 422, code: 'DAY_NOT_ASSIGNABLE', message: 'day 4 is a Saturday' },
      });
    });
  });

  describe('FILTER-2: StatusNotAssignableError → HTTP 400 with code "STATUS_NOT_ASSIGNABLE"', () => {
    it('maps StatusNotAssignableError to 400 with code and message in envelope', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new StatusNotAssignableError('statusCode "SAB" is not assignable');

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(400);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { status: 400, code: 'STATUS_NOT_ASSIGNABLE', message: 'statusCode "SAB" is not assignable' },
      });
    });
  });

  describe('FILTER-3: error.status is still present for domain errors (additive — no rename)', () => {
    it('DayNotAssignableError response body contains error.status = 422', () => {
      const filter = new AppExceptionFilter();
      const { host, jsonFn } = makeMockHost();
      filter.catch(new DayNotAssignableError('test'), host);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.status).toBe(422);
    });

    it('StatusNotAssignableError response body contains error.status = 400', () => {
      const filter = new AppExceptionFilter();
      const { host, jsonFn } = makeMockHost();
      filter.catch(new StatusNotAssignableError('test'), host);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.status).toBe(400);
    });
  });

  describe('FILTER-4: Non-domain HttpException → error.code is absent (no regression)', () => {
    it('HttpException 404 — status is correct and code is absent', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(404);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBeUndefined();
    });

    it('HttpException 400 with object response — existing envelope handling unchanged', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new HttpException({ message: 'Bad request', statusCode: 400 }, HttpStatus.BAD_REQUEST);

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(400);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.status).toBe(400);
      expect(body.error.code).toBeUndefined();
    });
  });

  describe('FILTER-5: Existing domain error (NOT_FOUND) → code appears in error.code', () => {
    it('NotFoundError maps to 404 and includes code "NOT_FOUND" in envelope', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new NotFoundError('CourseCycle', 'cc-1');

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(404);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.status).toBe(404);
    });
  });

  describe('FILTER-6: MonthClosedError / PreviousMonthOpenError → HTTP 409', () => {
    it('MonthClosedError maps to 409 with code "MONTH_CLOSED"', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new MonthClosedError('cc-1', 2026, 6);

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(409);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('MONTH_CLOSED');
      expect(body.error.status).toBe(409);
    });

    it('PreviousMonthOpenError maps to 409 with code "PREVIOUS_MONTH_OPEN"', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new PreviousMonthOpenError('cc-1', 2026, 6);

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(409);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('PREVIOUS_MONTH_OPEN');
      expect(body.error.status).toBe(409);
    });
  });
});
