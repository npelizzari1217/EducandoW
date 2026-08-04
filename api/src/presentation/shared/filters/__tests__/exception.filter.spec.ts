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
 *   FILTER-7: PresenteTypeNotFoundError → HTTP 422 (asistencia-autollenado-p PR-4)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  DayNotAssignableError,
  StatusNotAssignableError,
  NotFoundError,
  MonthClosedError,
  PreviousMonthOpenError,
  PresenteTypeNotFoundError,
  GrupoMateriaMismatchError,
} from '@educandow/domain';
import type { ArgumentsHost } from '@nestjs/common';
import { ApplicationError } from '../../../../application/shared/errors/application-error';

// Local stub — mirrors a real ApplicationError subclass without pulling in the users module.
class StubApplicationError extends ApplicationError {
  constructor(message: string, code: string, httpStatus: number) {
    super(message, code, httpStatus);
  }
}

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

  describe('ARR-R2/R7 Option B: HttpException branch re-reads `code` from the thrown response object', () => {
    it('HttpException with a `code` key in its response body → code IS preserved in the final envelope', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new HttpException(
        { statusCode: 404, code: 'COURSE_CYCLE_NOT_FOUND', message: 'CourseCycle no encontrado' },
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(404);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe('COURSE_CYCLE_NOT_FOUND');
      expect(body.error.message).toBe('CourseCycle no encontrado');
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

  describe('FILTER-7: PresenteTypeNotFoundError → HTTP 422', () => {
    it('maps PresenteTypeNotFoundError to 422 with code "PRESENTE_TYPE_NOT_FOUND"', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new PresenteTypeNotFoundError(1, 'cc-1');

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(422);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('PRESENTE_TYPE_NOT_FOUND');
      expect(body.error.status).toBe(422);
    });
  });

  describe('FILTER-8: GrupoMateriaMismatchError → HTTP 422, not 500 (MGCM-R3)', () => {
    it('maps GrupoMateriaMismatchError to 422 with code "GRUPO_MATERIA_MISMATCH"', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new GrupoMateriaMismatchError();

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(422);
      expect(statusFn).not.toHaveBeenCalledWith(500);
      const body: { error: Record<string, unknown> } = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('GRUPO_MATERIA_MISMATCH');
      expect(body.error.status).toBe(422);
    });
  });

  describe('AEM-R2: ApplicationError branch', () => {
    // AEM-R2.S1 — ApplicationError instance maps to its own httpStatus and code
    it('maps ApplicationError to its own httpStatus, code and message', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn, jsonFn } = makeMockHost();
      const exc = new StubApplicationError('denied', 'SOME_CODE', 403);

      filter.catch(exc, host);

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({
        error: { status: 403, code: 'SOME_CODE', message: 'denied' },
      });
    });

    // AEM-R2.S2 — does not fall through to the generic Error branch (which would leave status at 500)
    it('does not fall through to the generic Error fallback (status is never 500)', () => {
      const filter = new AppExceptionFilter();
      const { host, statusFn } = makeMockHost();
      const exc = new StubApplicationError('denied', 'SOME_CODE', 403);

      filter.catch(exc, host);

      expect(statusFn).not.toHaveBeenCalledWith(500);
    });

    // AEM-R2.S3 — DomainError handling is unaffected (regression, reuses FILTER-5 case)
    it('DomainError (e.g. NotFoundError) still maps via DOMAIN_STATUS, unaffected by the new branch', () => {
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
});
