/**
 * F6 — Three-door access model on attendance writes (HTTP, real app).
 *
 * Door 1: module ATTENDANCE:CREATE (RolesGuard, reads JWT claims).
 * Door 2: assignment scope (preceptor of CursoXCiclo for daily attendance).
 * Both must pass; missing either → 403.
 *
 * - F6-T9: module + assignment matrix (both → 201; module-only → 403; assignment-only → 403).
 * - F6-T3: Door 1 fails (no module) while Door 2 would pass → 403 at @Roles.
 * - F6-T8: daily and subject attendance for the same student+date persist independently.
 *
 * Auth is minted directly (signToken); the request's JWT dbName routes
 * TenantMiddleware to the test tenant DB, where the factories seed the scenario.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, closeTestApp, signToken, ATTENDANCE_CREATE } from '../setup/http';
import { masterClient, tenantI1Client, resetAll, disconnectAll } from '../setup/clients';
import { TENANT_I1_DB } from '../setup/test-db';
import {
  createInstitution,
  seedCourseCycle,
  createStudent,
  createDocenteXCiclo,
  createAsignacionPreceptor,
  createSubject,
  createMateriaXCursoXCiclo,
  createGrupo,
} from '../setup/factories';

const DATE = '2026-08-10';

describe('F6 — 3-door enforcement on attendance writes', () => {
  let app: INestApplication;
  let institutionId: string;

  beforeEach(async () => {
    await resetAll();
    const inst = await createInstitution(masterClient(), { dbName: TENANT_I1_DB, name: 'I1' });
    institutionId = inst.id;
    app = await bootTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
    await disconnectAll();
  });

  /** Seeds a course-cycle + student + a preceptor (DocenteXCiclo for `userId`). */
  async function seedPreceptorScenario(userId: string) {
    const i1 = tenantI1Client();
    const { cycle, courseCycle } = await seedCourseCycle(i1);
    const student = await createStudent(i1);
    const docente = await createDocenteXCiclo(i1, { userId, cycleId: cycle.uuid });
    await createAsignacionPreceptor(i1, {
      courseCycleId: courseCycle.uuid,
      docenteXCicloId: docente.id,
    });
    return { cycle, courseCycle, student, docente };
  }

  function tokenFor(
    sub: string,
    opts: { withModule?: boolean; roles?: string[] } = {},
  ): string {
    return signToken({
      sub,
      roles: opts.roles ?? ['TEACHER'],
      modules: opts.withModule === false ? [] : [ATTENDANCE_CREATE],
      institutionId,
      dbName: TENANT_I1_DB,
    });
  }

  const postDaily = (ccUuid: string, token: string, studentId: string) =>
    request(app.getHttpServer())
      .post(`/v1/course-cycles/${ccUuid}/asistencia-diaria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId, date: DATE, statusCode: 'A' });

  it('F6-T9 — Door 1 + Door 2 both satisfied → 201', async () => {
    const userId = 'u-both';
    const { courseCycle, student } = await seedPreceptorScenario(userId);
    const res = await postDaily(courseCycle.uuid, tokenFor(userId), student.id);
    expect(res.status).toBe(201);
  });

  it('F6-T9 — module present but assignment absent → 403 (Door 2 fails)', async () => {
    // Scenario seeded for a different teacher; the requester is not assigned.
    const { courseCycle, student } = await seedPreceptorScenario('u-owner');
    const res = await postDaily(courseCycle.uuid, tokenFor('u-stranger'), student.id);
    expect(res.status).toBe(403);
  });

  it('F6-T3 / F6-T9 — assignment present but module absent → 403 (Door 1 fails at @Roles)', async () => {
    const userId = 'u-nomodule';
    const { courseCycle, student } = await seedPreceptorScenario(userId);
    const res = await postDaily(courseCycle.uuid, tokenFor(userId, { withModule: false }), student.id);
    expect(res.status).toBe(403);
  });

  it('F6-T8 — daily and subject attendance for same student+date persist independently', async () => {
    const userId = 'u-dual';
    const i1 = tenantI1Client();
    const { courseCycle, student, docente } = await seedPreceptorScenario(userId);

    // Same docente also owns a subject group → passes Door 2 on the subject axis too.
    const subject = await createSubject(i1);
    const materia = await createMateriaXCursoXCiclo(i1, {
      courseCycleId: courseCycle.uuid,
      subjectId: subject.id,
    });
    const grupo = await createGrupo(i1, {
      materiaXCursoXCicloId: materia.id,
      docenteXCicloId: docente.id,
    });

    const token = tokenFor(userId);

    const daily = await postDaily(courseCycle.uuid, token, student.id);
    expect(daily.status).toBe(201);

    const subjectAbsence = await request(app.getHttpServer())
      .post(`/v1/grupos/${grupo.id}/ausencias`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: student.id, date: DATE });
    expect(subjectAbsence.status).toBe(201);

    // Both records exist, in their own tables, untouched by each other.
    const dailyRow = await i1.asistenciaDiaria.findFirst({
      where: { courseCycleId: courseCycle.uuid, studentId: student.id },
    });
    const subjectRow = await i1.ausenciaXGrupo.findFirst({
      where: { grupoId: grupo.id, studentId: student.id },
    });
    expect(dailyRow).not.toBeNull();
    expect(subjectRow).not.toBeNull();
  });
});
