/**
 * AsistenciaController — unit tests (TDD RED, T-26).
 *
 * Tests written BEFORE the controller exists (strict TDD).
 * Mirror grading-periods.controller.test.ts pattern: Object.create + prototype injection.
 *
 * Covers:
 *   CTR-T01: POST /course-cycles/:ccId/asistencia-mensual/generate — happy path returns counts
 *   CTR-T02: POST generate — ForbiddenError → ForbiddenException
 *   CTR-T03: GET /course-cycles/:ccId/asistencia-mensual — returns mapped rows
 *   CTR-T04: GET listGeneral — ForbiddenError → ForbiddenException
 *   CTR-T05: PATCH /course-cycles/:ccId/asistencia-mensual/dia — returns mapped row
 *   CTR-T06: PATCH recordGeneralDay — ForbiddenError → ForbiddenException
 *   CTR-T07: GET /materias-curso-ciclo/:materiaId/asistencia-mensual — returns mapped rows
 *   CTR-T08: GET listSubject — passes grupoId through
 *   CTR-T09: PATCH /materias-curso-ciclo/:materiaId/asistencia-mensual/dia — returns mapped row
 *   CTR-T10: non-ForbiddenError propagates as-is
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ForbiddenError, AsistenciaXAlumnoXCursoXCiclo, AsistenciaXMateriaXAlumnoXCursoXCiclo, DayMap, Id } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AsistenciaController: any;

beforeAll(async () => {
  const mod = await import('../asistencia.controller');
  AsistenciaController = mod.AsistenciaController;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser = { userId: 'u-1', roles: ['ADMIN'], institutionId: 'inst-1' };

function makeGeneralRow(id = 'row-1'): AsistenciaXAlumnoXCursoXCiclo {
  return AsistenciaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct(id),
    courseCycleId: 'cc-1',
    studentId: 'stu-1',
    year: 2026,
    month: 6,
    days: DayMap.empty(),
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
  });
}

function makeMateriaRow(id = 'row-m1'): AsistenciaXMateriaXAlumnoXCursoXCiclo {
  return AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct(id),
    materiaXCursoXCicloId: 'mx-1',
    studentId: 'stu-1',
    year: 2026,
    month: 6,
    days: DayMap.empty(),
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
  });
}

const generationCounts = { generalCreated: 3, generalSkipped: 1, materiaCreated: 6, materiaSkipped: 2 };

// ── Factory ───────────────────────────────────────────────────────────────────

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(AsistenciaController.prototype);
  ctrl.generateMonthlyUC = overrides.generateMonthlyUC ?? {
    execute: vi.fn().mockResolvedValue(generationCounts),
  };
  ctrl.listGeneralUC = overrides.listGeneralUC ?? {
    execute: vi.fn().mockResolvedValue([makeGeneralRow()]),
  };
  ctrl.recordGeneralUC = overrides.recordGeneralUC ?? {
    execute: vi.fn().mockResolvedValue(makeGeneralRow()),
  };
  ctrl.listSubjectUC = overrides.listSubjectUC ?? {
    execute: vi.fn().mockResolvedValue([makeMateriaRow()]),
  };
  ctrl.recordSubjectUC = overrides.recordSubjectUC ?? {
    execute: vi.fn().mockResolvedValue(makeMateriaRow()),
  };
  return ctrl;
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /course-cycles/:ccId/asistencia-mensual/generate
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — generateMonthly', () => {
  it('CTR-T01: returns generation counts on success', async () => {
    const ctrl = makeController();
    const body = { year: 2026, month: 6 };

    const result = await ctrl.generateMonthly('cc-1', mockUser, body);

    expect(result.data).toEqual(generationCounts);
    expect(ctrl.generateMonthlyUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      year: 2026,
      month: 6,
      userId: 'u-1',
      userRoles: ['ADMIN'],
    });
  });

  it('CTR-T02: ForbiddenError from use-case → throws ForbiddenException', async () => {
    const ctrl = makeController({
      generateMonthlyUC: {
        execute: vi.fn().mockRejectedValue(new ForbiddenError('not allowed')),
      },
    });

    await expect(ctrl.generateMonthly('cc-1', mockUser, { year: 2026, month: 6 }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /course-cycles/:ccId/asistencia-mensual
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — listGeneral', () => {
  it('CTR-T03: returns mapped general rows', async () => {
    const ctrl = makeController();
    const query = { year: 2026, month: 6 };

    const result = await ctrl.listGeneral('cc-1', mockUser, query);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'row-1',
      courseCycleId: 'cc-1',
      studentId: 'stu-1',
      year: 2026,
      month: 6,
      days: {},
    });
  });

  it('CTR-T04: ForbiddenError → ForbiddenException', async () => {
    const ctrl = makeController({
      listGeneralUC: {
        execute: vi.fn().mockRejectedValue(new ForbiddenError('no access')),
      },
    });

    await expect(ctrl.listGeneral('cc-1', mockUser, { year: 2026, month: 6 }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /course-cycles/:ccId/asistencia-mensual/dia
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — recordGeneralDay', () => {
  it('CTR-T05: returns mapped updated row', async () => {
    const ctrl = makeController();
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 5, statusCode: 'P' };

    const result = await ctrl.recordGeneralDay('cc-1', mockUser, body);

    expect(result.data).toMatchObject({
      id: 'row-1',
      courseCycleId: 'cc-1',
      studentId: 'stu-1',
    });
    expect(ctrl.recordGeneralUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      studentId: 'stu-1',
      year: 2026,
      month: 6,
      day: 5,
      statusCode: 'P',
      userId: 'u-1',
      userRoles: ['ADMIN'],
    });
  });

  it('CTR-T06: ForbiddenError → ForbiddenException', async () => {
    const ctrl = makeController({
      recordGeneralUC: {
        execute: vi.fn().mockRejectedValue(new ForbiddenError('preceptor only')),
      },
    });
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 5, statusCode: 'P' };

    await expect(ctrl.recordGeneralDay('cc-1', mockUser, body))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /materias-curso-ciclo/:materiaId/asistencia-mensual
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — listSubject', () => {
  it('CTR-T07: returns mapped subject rows', async () => {
    const ctrl = makeController();
    const query = { year: 2026, month: 6 };

    const result = await ctrl.listSubject('mx-1', mockUser, query);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'row-m1',
      materiaXCursoXCicloId: 'mx-1',
      studentId: 'stu-1',
      year: 2026,
      month: 6,
      days: {},
    });
  });

  it('CTR-T08: passes grupoId through to use-case', async () => {
    const ctrl = makeController({
      listSubjectUC: {
        execute: vi.fn().mockResolvedValue([makeMateriaRow()]),
      },
    });
    const query = { year: 2026, month: 6, grupoId: 'grp-1' };

    await ctrl.listSubject('mx-1', mockUser, query);

    expect(ctrl.listSubjectUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mx-1',
      year: 2026,
      month: 6,
      grupoId: 'grp-1',
      userId: 'u-1',
      userRoles: ['ADMIN'],
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /materias-curso-ciclo/:materiaId/asistencia-mensual/dia
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — recordSubjectDay', () => {
  it('CTR-T09: returns mapped updated subject row', async () => {
    const ctrl = makeController();
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 10, statusCode: 'A' };

    const result = await ctrl.recordSubjectDay('mx-1', mockUser, body);

    expect(result.data).toMatchObject({
      id: 'row-m1',
      materiaXCursoXCicloId: 'mx-1',
      studentId: 'stu-1',
    });
    expect(ctrl.recordSubjectUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mx-1',
      studentId: 'stu-1',
      year: 2026,
      month: 6,
      day: 10,
      statusCode: 'A',
      userId: 'u-1',
      userRoles: ['ADMIN'],
    });
  });

  it('CTR-T10: non-ForbiddenError propagates as-is', async () => {
    const domainError = new Error('NotFound: row not found');
    const ctrl = makeController({
      recordSubjectUC: {
        execute: vi.fn().mockRejectedValue(domainError),
      },
    });
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 10, statusCode: 'A' };

    await expect(ctrl.recordSubjectDay('mx-1', mockUser, body)).rejects.toBe(domainError);
  });
});
