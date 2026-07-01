/**
 * PR2 — controller-level integration test: exercises the REAL HTTP pipeline
 * (guards → controller → global exception filter) for GET /attendance-types,
 * WITHOUT a live DB/tenant context (use cases are mocked at the DI boundary,
 * only AuthGuard is overridden to inject a fixed @CurrentUser()).
 *
 * Verifies ADD-4.1 end-to-end: a `?level=` outside the caller's scope MUST
 * produce a REAL HTTP 403 with the `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`
 * envelope — never a 200 with `{ data: [] }` as a substitute.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { AttendanceTypeLevelOutOfScopeError } from '@educandow/domain';
import { AttendanceTypeController } from '../attendance-type.controller';
import { AuthGuard } from '../../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../../infrastructure/auth/guards/roles.guard';
import { AppExceptionFilter } from '../../shared/filters/exception.filter';
import {
  CreateAttendanceTypeUseCase,
  UpdateAttendanceTypeUseCase,
  DeleteAttendanceTypeUseCase,
  ListAttendanceTypesUseCase,
  GetAttendanceTypeUseCase,
} from '../../../application/attendance-type/use-cases/attendance-type.use-cases';

const teacherLevel2 = { userId: 'u-teacher', roles: ['TEACHER'], levels: [20] };

/** AuthGuard override — injects a fixed AuthenticatedUser without verifying a real JWT. */
function makeFakeAuthGuard(user: Record<string, unknown>): CanActivate {
  return {
    canActivate(ctx: ExecutionContext) {
      const req = ctx.switchToHttp().getRequest();
      req.user = user;
      return true;
    },
  };
}

/**
 * RolesGuard override — bypasses module/action permission checks (out of scope for this
 * test: we're verifying the level-scope 403 mapping, orthogonal to RBAC). RolesGuard's
 * own behavior already has dedicated unit tests (roles.guard.test.ts).
 */
const allowAllGuard: CanActivate = { canActivate: () => true };

describe('AttendanceTypeController (controller e2e — GET /attendance-types)', () => {
  let app: INestApplication;
  const listExecute = vi.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceTypeController],
      providers: [
        { provide: CreateAttendanceTypeUseCase, useValue: { execute: vi.fn() } },
        { provide: ListAttendanceTypesUseCase, useValue: { execute: listExecute } },
        { provide: GetAttendanceTypeUseCase, useValue: { execute: vi.fn() } },
        { provide: UpdateAttendanceTypeUseCase, useValue: { execute: vi.fn() } },
        { provide: DeleteAttendanceTypeUseCase, useValue: { execute: vi.fn() } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(makeFakeAuthGuard(teacherLevel2))
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /attendance-types?level=<out-of-scope> returns REAL HTTP 403 with the ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE envelope', async () => {
    listExecute.mockRejectedValueOnce(new AttendanceTypeLevelOutOfScopeError(3));

    const res = await request(app.getHttpServer()).get('/attendance-types?level=3');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE');
    expect(res.body.data).toBeUndefined();
  });

  it('GET /attendance-types?level=<in-scope> returns HTTP 200 with { data: [...] }', async () => {
    listExecute.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer()).get('/attendance-types?level=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
