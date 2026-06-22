/**
 * F6-T9 — 3-door enforcement at HTTP level (test-debt closure).
 *
 * Validates the PATCH /v1/course-cycles/:ccId/asistencia-mensual/dia endpoint
 * against the three-door security model:
 *
 *   Door 1 (RolesGuard): JWT must carry modules=[ATTENDANCE:CREATE] or role ROOT.
 *   Door 2 (use-case):   user must be a preceptor for the CourseCycle
 *                         (AsignacionCursoXCiclo with rol=PRECEPTOR exists via DocenteXCiclo).
 *
 * Test cases:
 *   (a) JWT has ATTENDANCE:CREATE but user is NOT a preceptor → 403 (Door 2 fails)
 *   (b) user IS a preceptor but JWT lacks ATTENDANCE module/action → 403 (Door 1 fails)
 *   (c) both present → 200 (day persisted)
 *
 * Uses bootTestApp() + signToken() to drive the production NestJS stack end-to-end.
 * Tenant routing via dbName='educandow_test_i1' in the JWT — TenantMiddleware resolves
 * the institution from master DB and injects the test tenant client.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, closeTestApp, signToken, ATTENDANCE_CREATE } from '../setup/http';
import {
  masterClient,
  tenantI1Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import {
  createInstitution,
  seedCourseCycle,
  createStudent,
  createAlumnosXCursoXCiclo,
  createDocenteXCiclo,
  createAsignacionPreceptor,
} from '../setup/factories';
import { PrismaAsistenciaGeneralRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository';
import { PrismaAsistenciaMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository';
import { PrismaAlumnosXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';
import { GenerateMonthlyAttendanceUseCase } from '../../../src/application/asistencia/generate-monthly-attendance.use-case';

// ── Repos for seeding ─────────────────────────────────────────────────────────

const generalRepo = new PrismaAsistenciaGeneralRepository();
const materiaAsistRepo = new PrismaAsistenciaMateriaRepository();
const alumnosCCRepo = new PrismaAlumnosXCursoXCicloRepository();
const mxccRepo = new PrismaMateriaXCursoXCicloRepository();
const alumnosXMateriaRepo = new PrismaAlumnosXMateriaRepository();

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
);

const YEAR = 2026;
const MONTH = 6;
const TENANT_DB = 'educandow_test_i1';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('F6-T9 — 3-door enforcement (HTTP level)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
    await disconnectAll();
  });

  beforeEach(async () => {
    await resetAll();
    // Institution must exist in master DB so TenantMiddleware can resolve TENANT_DB
    await createInstitution(masterClient(), { dbName: TENANT_DB });
  });

  // ── (a) Door 2 fails: has module permission but is NOT a preceptor ───────────

  describe('(a) ATTENDANCE:CREATE present but user is not a preceptor', () => {
    it('returns 403 when JWT has ATTENDANCE:CREATE but no preceptor assignment exists', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);

      const token = signToken({
        sub: 'user-a',
        roles: ['TEACHER'],
        modules: [ATTENDANCE_CREATE],
        dbName: TENANT_DB,
      });

      const res = await request(app.getHttpServer())
        .patch(`/v1/course-cycles/${courseCycle.uuid}/asistencia-mensual/dia`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          studentId: student.id,
          year: YEAR,
          month: MONTH,
          day: 5,
          statusCode: 'P',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── (b) Door 1 fails: preceptor exists but no ATTENDANCE module in JWT ────────

  describe('(b) preceptor assignment exists but JWT lacks ATTENDANCE:CREATE', () => {
    it('returns 403 when user is a preceptor but JWT carries no ATTENDANCE module', async () => {
      const i1 = tenantI1Client();
      const { cycle, courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);

      // Seed: teacher is a real preceptor in the tenant DB
      const docente = await createDocenteXCiclo(i1, { userId: 'user-b', cycleId: cycle.uuid });
      await createAsignacionPreceptor(i1, {
        courseCycleId: courseCycle.uuid,
        docenteXCicloId: docente.id,
      });

      // JWT has no ATTENDANCE module → RolesGuard (Door 1) will block
      const token = signToken({
        sub: 'user-b',
        roles: ['TEACHER'],
        modules: [],
        dbName: TENANT_DB,
      });

      const res = await request(app.getHttpServer())
        .patch(`/v1/course-cycles/${courseCycle.uuid}/asistencia-mensual/dia`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          studentId: student.id,
          year: YEAR,
          month: MONTH,
          day: 5,
          statusCode: 'P',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── (c) Both doors pass → 200 + row persisted ────────────────────────────────

  describe('(c) ATTENDANCE:CREATE present AND user is a preceptor', () => {
    it('returns 200 and persists the recorded day when both doors are satisfied', async () => {
      const i1 = tenantI1Client();
      const { cycle, courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      // Seed: teacher is a preceptor for the CC
      const docente = await createDocenteXCiclo(i1, { userId: 'user-c', cycleId: cycle.uuid });
      await createAsignacionPreceptor(i1, {
        courseCycleId: courseCycle.uuid,
        docenteXCicloId: docente.id,
      });

      // Seed: attendance type so statusCode 'P' passes catalog validation
      await i1.attendanceType.create({
        data: {
          level: 1,
          code: 'P',
          description: 'Presente',
          absenceValue: 0,
          isPresent: true,
          assignable: true,
          isSystem: false,
          active: true,
        },
      });

      // Pre-generate the monthly register row (ADR-4: row must exist before recording)
      await runInTenant(i1, () =>
        generateUC.execute({
          courseCycleId: courseCycle.uuid,
          year: YEAR,
          month: MONTH,
          userId: 'admin-seed',
          userRoles: ['ADMIN'],
        }),
      );

      // JWT has both ATTENDANCE:CREATE module AND user is a preceptor (sub = 'user-c')
      const token = signToken({
        sub: 'user-c',
        roles: ['TEACHER'],
        modules: [ATTENDANCE_CREATE],
        dbName: TENANT_DB,
      });

      const res = await request(app.getHttpServer())
        .patch(`/v1/course-cycles/${courseCycle.uuid}/asistencia-mensual/dia`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          studentId: student.id,
          year: YEAR,
          month: MONTH,
          day: 5,
          statusCode: 'P',
        });

      expect(res.status).toBe(200);
      // Response body: { data: { id, courseCycleId, studentId, year, month, days } }
      expect(res.body.data).toBeDefined();
      expect(res.body.data.days['5']).toBe('P');
    });
  });
});
