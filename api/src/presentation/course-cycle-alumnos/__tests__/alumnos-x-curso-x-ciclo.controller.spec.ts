/**
 * AlumnosXCursoXCicloController — unit tests (TDD, T-16).
 *
 * Covers:
 *   POST /course-cycles/:ccId/alumnos   → 201 success, 404 CC not found, 404 student not found
 *   GET  /course-cycles/:ccId/alumnos   → 200 enriched list, 200 empty array
 *   DELETE /course-cycles/:ccId/alumnos/:id → 204 success, 404 not found
 *
 * Auth (401) is enforced by AuthGuard — a decorator concern, not testable in
 * pure unit tests that bypass NestJS DI. Zod 400 is covered by DTO schema tests below.
 *
 * Pattern: Object.create(prototype) + property injection, no NestJS bootstrap.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NotFoundError, PaseFechaInvalidaError, StudentHasPaseError } from '@educandow/domain';
import { AddStudentToCourseCycleSchema, RegistrarPaseSchema } from '../dto/alumnos-x-curso-x-ciclo.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AlumnosXCursoXCicloController: any;

beforeAll(async () => {
  const mod = await import('../alumnos-x-curso-x-ciclo.controller');
  AlumnosXCursoXCicloController = mod.AlumnosXCursoXCicloController;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(AlumnosXCursoXCicloController.prototype);
  ctrl.addUC = overrides.addUC ?? { execute: vi.fn() };
  ctrl.listUC = overrides.listUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.removeUC = overrides.removeUC ?? { execute: vi.fn().mockResolvedValue(undefined) };
  ctrl.togglePrintableUC = overrides.togglePrintableUC ?? { execute: vi.fn() };
  ctrl.setCoursePrintableUC = overrides.setCoursePrintableUC ?? { execute: vi.fn() };
  ctrl.listMembershipsUC = overrides.listMembershipsUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.cascadeUC = overrides.cascadeUC ?? { execute: vi.fn() };
  ctrl.bulkCascadeUC = overrides.bulkCascadeUC ?? { execute: vi.fn() };
  ctrl.registrarPaseUC = overrides.registrarPaseUC ?? { execute: vi.fn().mockResolvedValue(undefined) };
  return ctrl;
}

// ── POST /course-cycles/:ccId/alumnos ─────────────────────────────────────────

describe('AlumnosXCursoXCicloController — POST /course-cycles/:ccId/alumnos', () => {
  it('C-01: 201 — addUC.execute called with ccId + studentId, returns { data: AlumnoXCursoCicloResponse }', async () => {
    const row = { id: 'axcc-1', courseCycleId: 'cc-1', studentId: 'stu-1' };
    const addUC = { execute: vi.fn().mockResolvedValue(row) };
    const ctrl = makeController({ addUC });

    const result = await ctrl.addStudent('cc-1', { studentId: 'stu-1' });

    expect(addUC.execute).toHaveBeenCalledWith({ courseCycleId: 'cc-1', studentId: 'stu-1' });
    expect(result).toEqual({ data: { id: 'axcc-1', courseCycleId: 'cc-1', studentId: 'stu-1' } });
  });

  it('C-02: 404 — NotFoundError propagates when CourseCycle does not exist', async () => {
    const error = new NotFoundError('CourseCycle', 'cc-999');
    const addUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ addUC });

    await expect(ctrl.addStudent('cc-999', { studentId: 'stu-1' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('C-03: 404 — NotFoundError propagates when Student does not exist', async () => {
    const error = new NotFoundError('Student', 'stu-999');
    const addUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ addUC });

    await expect(ctrl.addStudent('cc-1', { studentId: 'stu-999' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── GET /course-cycles/:ccId/alumnos ──────────────────────────────────────────

describe('AlumnosXCursoXCicloController — GET /course-cycles/:ccId/alumnos', () => {
  it('C-04: 200 — returns { data: AlumnoCursoCicloItem[] } enriched list', async () => {
    const enriched = [
      { id: 'axcc-1', studentId: 'stu-1', studentName: 'Ana García' },
      { id: 'axcc-2', studentId: 'stu-2', studentName: 'Carlos López' },
    ];
    const listUC = { execute: vi.fn().mockResolvedValue(enriched) };
    const ctrl = makeController({ listUC });

    const result = await ctrl.listStudents('cc-1');

    expect(listUC.execute).toHaveBeenCalledWith('cc-1');
    expect(result).toEqual({ data: enriched });
  });

  it('C-05: 200 — returns { data: [] } when no students assigned (not 404)', async () => {
    const listUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = makeController({ listUC });

    const result = await ctrl.listStudents('cc-empty');

    expect(result).toEqual({ data: [] });
  });
});

// ── DELETE /course-cycles/:ccId/alumnos/:id ───────────────────────────────────

describe('AlumnosXCursoXCicloController — DELETE /course-cycles/:ccId/alumnos/:id', () => {
  it('C-06: 204 — removeUC.execute called with { courseCycleId, id }, returns undefined', async () => {
    const removeUC = { execute: vi.fn().mockResolvedValue(undefined) };
    const ctrl = makeController({ removeUC });

    const result = await ctrl.removeStudent('cc-1', 'axcc-1');

    expect(removeUC.execute).toHaveBeenCalledWith({ courseCycleId: 'cc-1', id: 'axcc-1' });
    expect(result).toBeUndefined();
  });

  it('C-07: 404 — NotFoundError propagates when enrollment row does not exist', async () => {
    const error = new NotFoundError('AlumnosXCursoXCiclo', 'axcc-999');
    const removeUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ removeUC });

    await expect(ctrl.removeStudent('cc-1', 'axcc-999')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── GET /students/:studentId/memberships ──────────────────────────────────────

describe('AlumnosXCursoXCicloController — GET /students/:studentId/memberships', () => {
  it('C-08: 200 — returns { data: StudentMembershipEnriched[] }', async () => {
    const memberships = [
      { id: 'axcc-1', courseCycleId: 'cc-1', printable: true, level: 3, academicYear: '2026', grade: '1', division: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const listMembershipsUC = { execute: vi.fn().mockResolvedValue(memberships) };
    const ctrl = Object.create(AlumnosXCursoXCicloController.prototype);
    ctrl.listMembershipsUC = listMembershipsUC;

    const result = await ctrl.listStudentMemberships('stu-1');

    expect(listMembershipsUC.execute).toHaveBeenCalledWith('stu-1');
    expect(result).toEqual({ data: memberships });
  });

  it('C-09: 200 — returns { data: [] } when student has no memberships', async () => {
    const listMembershipsUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = Object.create(AlumnosXCursoXCicloController.prototype);
    ctrl.listMembershipsUC = listMembershipsUC;

    const result = await ctrl.listStudentMemberships('stu-no-cc');

    expect(result).toEqual({ data: [] });
  });
});

// ── POST /course-cycles/:ccId/alumnos/:id/cascade ────────────────────────────

describe('AlumnosXCursoXCicloController — POST /course-cycles/:ccId/alumnos/:id/cascade', () => {
  it('C-10: 200 — cascadeUC.execute called with { id, ccId }, returns { data: counts }', async () => {
    const counts = { materiasCreated: 3, materiasSkipped: 0, competenciasCreated: 6, competenciasSkipped: 0 };
    const cascadeUC = { execute: vi.fn().mockResolvedValue(counts) };
    const ctrl = Object.create(AlumnosXCursoXCicloController.prototype);
    ctrl.addUC = { execute: vi.fn() };
    ctrl.listUC = { execute: vi.fn() };
    ctrl.removeUC = { execute: vi.fn() };
    ctrl.togglePrintableUC = { execute: vi.fn() };
    ctrl.setCoursePrintableUC = { execute: vi.fn() };
    ctrl.listMembershipsUC = { execute: vi.fn() };
    ctrl.cascadeUC = cascadeUC;

    const result = await ctrl.cascade('cc-1', 'acc-1');

    expect(cascadeUC.execute).toHaveBeenCalledWith({ id: 'acc-1', ccId: 'cc-1' });
    expect(result).toEqual({ data: counts });
  });

  it('C-11: 404 — NotFoundError propagates when bridge row does not exist', async () => {
    const error = new NotFoundError('AlumnosXCursoXCiclo', 'acc-999');
    const ctrl = Object.create(AlumnosXCursoXCicloController.prototype);
    ctrl.cascadeUC = { execute: vi.fn().mockRejectedValue(error) };

    await expect(ctrl.cascade('cc-1', 'acc-999')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── POST /course-cycles/:ccId/alumnos/cascade (bulk) ─────────────────────────

describe('AlumnosXCursoXCicloController — POST /course-cycles/:ccId/alumnos/cascade (bulk)', () => {
  it('C-12: 200 — bulkCascadeUC.execute called with { ccId }, returns { data: BulkCascadeResult }', async () => {
    const bulkResult = {
      studentsProcessed: 5,
      studentsFailed: 0,
      materiasCreated: 10,
      materiasSkipped: 0,
      competenciasCreated: 30,
      competenciasSkipped: 0,
    };
    const bulkCascadeUC = { execute: vi.fn().mockResolvedValue(bulkResult) };
    const ctrl = makeController({ bulkCascadeUC });

    const result = await ctrl.cascadeAll('cc-1');

    expect(bulkCascadeUC.execute).toHaveBeenCalledWith({ ccId: 'cc-1' });
    expect(result).toEqual({ data: bulkResult });
  });

  it('C-13: cascadeAll is declared BEFORE cascade in controller prototype (route-order guard)', () => {
    const methods = Object.getOwnPropertyNames(AlumnosXCursoXCicloController.prototype);
    const cascadeAllIdx = methods.indexOf('cascadeAll');
    const cascadeIdx = methods.indexOf('cascade');
    expect(cascadeAllIdx).toBeGreaterThan(-1);
    expect(cascadeIdx).toBeGreaterThan(-1);
    // Bulk route must be registered first — NestJS matches literally, :id would shadow "cascade"
    expect(cascadeAllIdx).toBeLessThan(cascadeIdx);
  });
});

// ── DTO schema — 400 validation ───────────────────────────────────────────────

describe('AddStudentToCourseCycleSchema — Zod validation (400 scenarios)', () => {
  it('D-01: accepts valid UUID studentId', () => {
    const result = AddStudentToCourseCycleSchema.safeParse({
      studentId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('D-02: rejects missing studentId', () => {
    const result = AddStudentToCourseCycleSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('D-03: rejects non-UUID string studentId', () => {
    const result = AddStudentToCourseCycleSchema.safeParse({ studentId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('D-04: rejects numeric studentId (wrong type)', () => {
    const result = AddStudentToCourseCycleSchema.safeParse({ studentId: 12345 });
    expect(result.success).toBe(false);
  });
});

// ── PATCH /course-cycles/:ccId/alumnos/:id/pase ───────────────────────────────

describe('AlumnosXCursoXCicloController — PATCH /course-cycles/:ccId/alumnos/:id/pase', () => {
  it('C-14: 204 — registrarPaseUC.execute called with Date when fechaDePase is a valid string', async () => {
    const registrarPaseUC = { execute: vi.fn().mockResolvedValue(undefined) };
    const ctrl = makeController({ registrarPaseUC });

    const result = await ctrl.registrarPase('cc-1', 'axcc-1', { fechaDePase: '2026-06-25' });

    expect(registrarPaseUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      id: 'axcc-1',
      fechaDePase: new Date('2026-06-25T00:00:00.000Z'),
    });
    expect(result).toBeUndefined();
  });

  it('C-15: 204 revert — registrarPaseUC.execute called with null when fechaDePase is null', async () => {
    const registrarPaseUC = { execute: vi.fn().mockResolvedValue(undefined) };
    const ctrl = makeController({ registrarPaseUC });

    const result = await ctrl.registrarPase('cc-1', 'axcc-1', { fechaDePase: null });

    expect(registrarPaseUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      id: 'axcc-1',
      fechaDePase: null,
    });
    expect(result).toBeUndefined();
  });

  it('C-16: 400 — PaseFechaInvalidaError propagates when UC throws (future date)', async () => {
    const error = new PaseFechaInvalidaError();
    const registrarPaseUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ registrarPaseUC });

    await expect(
      ctrl.registrarPase('cc-1', 'axcc-1', { fechaDePase: '2099-12-31' }),
    ).rejects.toBeInstanceOf(PaseFechaInvalidaError);
  });

  it('C-17: 404 — NotFoundError propagates when CC or enrollment not found', async () => {
    const error = new NotFoundError('CourseCycle', 'cc-999');
    const registrarPaseUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ registrarPaseUC });

    await expect(
      ctrl.registrarPase('cc-999', 'axcc-1', { fechaDePase: '2026-06-25' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('C-18: 409 — StudentHasPaseError propagates (exception filter maps to 409)', async () => {
    const error = new StudentHasPaseError();
    const registrarPaseUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ registrarPaseUC });

    await expect(
      ctrl.registrarPase('cc-1', 'axcc-1', { fechaDePase: '2026-06-25' }),
    ).rejects.toBeInstanceOf(StudentHasPaseError);
  });
});

// ── DTO schema — RegistrarPaseSchema (422 scenarios) ─────────────────────────

describe('RegistrarPaseSchema — Zod validation (422 scenarios)', () => {
  it('D-05: accepts valid YYYY-MM-DD date string', () => {
    const result = RegistrarPaseSchema.safeParse({ fechaDePase: '2026-06-25' });
    expect(result.success).toBe(true);
  });

  it('D-06: accepts null (revert pase)', () => {
    const result = RegistrarPaseSchema.safeParse({ fechaDePase: null });
    expect(result.success).toBe(true);
  });

  it('D-07: rejects missing fechaDePase field', () => {
    const result = RegistrarPaseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('D-08: rejects invalid date format "no-es-fecha"', () => {
    const result = RegistrarPaseSchema.safeParse({ fechaDePase: 'no-es-fecha' });
    expect(result.success).toBe(false);
  });
});
