/**
 * AsistenciaController — unit tests (TDD RED → GREEN, T-26 + T-BE-4).
 *
 * Updated for enriched list use-cases (EnrichedGeneralAttendance / EnrichedMateriaAttendance).
 *
 * Covers:
 *   CTR-T01: POST generate — returns counts
 *   CTR-T02: POST generate — ForbiddenError → ForbiddenException
 *   CTR-T03: GET listGeneral — returns mapped rows with studentName "Apellido, Nombre"
 *   CTR-T04: GET listGeneral — ForbiddenError → ForbiddenException
 *   CTR-T05: PATCH recordGeneralDay — studentName === '' (ADR-5)
 *   CTR-T06: PATCH recordGeneralDay — ForbiddenError → ForbiddenException
 *   CTR-T07: GET listSubject — returns mapped rows with studentName "Apellido, Nombre"
 *   CTR-T08: GET listSubject — passes grupoId through
 *   CTR-T09: PATCH recordSubjectDay — studentName === '' (ADR-5)
 *   CTR-T10: non-ForbiddenError propagates as-is
 *   CTR-T11: GET estado — returns mapped status (OPEN default / CLOSED with attribution)
 *   CTR-T12: PATCH estado — status:'CLOSED' calls closeMonthUC; status:'OPEN' calls openMonthUC
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  ForbiddenError,
  AsistenciaXAlumnoXCursoXCiclo,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  DayMap,
  Id,
} from '@educandow/domain';
import type { EnrichedGeneralAttendance, EnrichedMateriaAttendance } from '@educandow/domain';

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

/** Enriched wrapper for listGeneral mock (returns { attendance, studentName }). */
function makeEnrichedGeneral(id = 'row-1', studentName = 'Pérez, Juan'): EnrichedGeneralAttendance {
  return { attendance: makeGeneralRow(id), studentName };
}

/** Enriched wrapper for listSubject mock (returns { attendance, studentName }). */
function makeEnrichedMateria(id = 'row-m1', studentName = 'García, Ana'): EnrichedMateriaAttendance {
  return { attendance: makeMateriaRow(id), studentName };
}

const generationCounts = { generalCreated: 3, generalSkipped: 1, materiaCreated: 6, materiaSkipped: 2 };

// ── Factory ───────────────────────────────────────────────────────────────────

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(AsistenciaController.prototype);
  ctrl.generateMonthlyUC = overrides.generateMonthlyUC ?? {
    execute: vi.fn().mockResolvedValue(generationCounts),
  };
  // listGeneralUC now returns EnrichedGeneralAttendance[]
  ctrl.listGeneralUC = overrides.listGeneralUC ?? {
    execute: vi.fn().mockResolvedValue([makeEnrichedGeneral()]),
  };
  // recordGeneralUC still returns a plain domain entity (no enrichment on PATCH)
  ctrl.recordGeneralUC = overrides.recordGeneralUC ?? {
    execute: vi.fn().mockResolvedValue(makeGeneralRow()),
  };
  // listSubjectUC now returns EnrichedMateriaAttendance[]
  ctrl.listSubjectUC = overrides.listSubjectUC ?? {
    execute: vi.fn().mockResolvedValue([makeEnrichedMateria()]),
  };
  // recordSubjectUC still returns a plain domain entity
  ctrl.recordSubjectUC = overrides.recordSubjectUC ?? {
    execute: vi.fn().mockResolvedValue(makeMateriaRow()),
  };
  // Attendance month status use-cases (PR-3b)
  ctrl.getMonthStatusUC = overrides.getMonthStatusUC ?? {
    execute: vi.fn().mockResolvedValue(makeOpenStatusResult()),
  };
  ctrl.openMonthUC = overrides.openMonthUC ?? {
    execute: vi.fn().mockResolvedValue(makeOpenStatusResult()),
  };
  ctrl.closeMonthUC = overrides.closeMonthUC ?? {
    execute: vi.fn().mockResolvedValue(makeClosedStatusResult()),
  };
  return ctrl;
}

function makeOpenStatusResult() {
  return { courseCycleId: 'cc-1', year: 2026, month: 6, closed: false, closedAt: null, closedBy: null };
}

function makeClosedStatusResult() {
  return {
    courseCycleId: 'cc-1', year: 2026, month: 6, closed: true,
    closedAt: new Date('2026-06-15T00:00:00.000Z'), closedBy: 'user-1',
  };
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
  it('CTR-T03: returns mapped general rows with studentName in "Apellido, Nombre" format', async () => {
    const ctrl = makeController();
    const query = { year: 2026, month: 6 };

    const result = await ctrl.listGeneral('cc-1', mockUser, query);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'row-1',
      courseCycleId: 'cc-1',
      studentId: 'stu-1',
      studentName: 'Pérez, Juan',
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
  it("CTR-T05: returns mapped updated row with studentName === '' (ADR-5)", async () => {
    const ctrl = makeController();
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 5, statusCode: 'P' };

    const result = await ctrl.recordGeneralDay('cc-1', mockUser, body);

    expect(result.data).toMatchObject({
      id: 'row-1',
      courseCycleId: 'cc-1',
      studentId: 'stu-1',
      studentName: '',
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
  it('CTR-T07: returns mapped subject rows with studentName in "Apellido, Nombre" format', async () => {
    const ctrl = makeController();
    const query = { year: 2026, month: 6 };

    const result = await ctrl.listSubject('mx-1', mockUser, query);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'row-m1',
      materiaXCursoXCicloId: 'mx-1',
      studentId: 'stu-1',
      studentName: 'García, Ana',
      year: 2026,
      month: 6,
      days: {},
    });
  });

  it('CTR-T08: passes grupoId through to use-case', async () => {
    const ctrl = makeController({
      listSubjectUC: {
        execute: vi.fn().mockResolvedValue([makeEnrichedMateria()]),
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
  it("CTR-T09: returns mapped updated subject row with studentName === '' (ADR-5)", async () => {
    const ctrl = makeController();
    const body = { studentId: 'stu-1', year: 2026, month: 6, day: 10, statusCode: 'A' };

    const result = await ctrl.recordSubjectDay('mx-1', mockUser, body);

    expect(result.data).toMatchObject({
      id: 'row-m1',
      materiaXCursoXCicloId: 'mx-1',
      studentId: 'stu-1',
      studentName: '',
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

// ═════════════════════════════════════════════════════════════════════════════
// GET/PATCH /course-cycles/:ccId/asistencia-mensual/estado (PR-3b, Capacidad B)
// ═════════════════════════════════════════════════════════════════════════════

describe('AsistenciaController — getMonthStatus', () => {
  it('CTR-T11a: returns default OPEN status when no row exists', async () => {
    const ctrl = makeController();
    const query = { year: 2026, month: 6 };

    const result = await ctrl.getMonthStatus('cc-1', query);

    expect(result.data).toEqual({
      courseCycleId: 'cc-1', year: 2026, month: 6, status: 'OPEN', closedAt: null, closedBy: null,
    });
    expect(ctrl.getMonthStatusUC.execute).toHaveBeenCalledWith({ courseCycleId: 'cc-1', year: 2026, month: 6 });
  });

  it('CTR-T11b: returns CLOSED status with attribution when the month is closed', async () => {
    const ctrl = makeController({
      getMonthStatusUC: { execute: vi.fn().mockResolvedValue(makeClosedStatusResult()) },
    });
    const query = { year: 2026, month: 6 };

    const result = await ctrl.getMonthStatus('cc-1', query);

    expect(result.data).toEqual({
      courseCycleId: 'cc-1',
      year: 2026,
      month: 6,
      status: 'CLOSED',
      closedAt: '2026-06-15T00:00:00.000Z',
      closedBy: 'user-1',
    });
  });
});

describe('AsistenciaController — setMonthStatus', () => {
  it("CTR-T12a: status:'CLOSED' calls closeMonthUC with courseCycleId/year/month/userId", async () => {
    const ctrl = makeController();
    const body = { year: 2026, month: 6, status: 'CLOSED' as const };

    const result = await ctrl.setMonthStatus('cc-1', mockUser, body);

    expect(ctrl.closeMonthUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1', year: 2026, month: 6, userId: 'u-1',
    });
    expect(ctrl.openMonthUC.execute).not.toHaveBeenCalled();
    expect(result.data.status).toBe('CLOSED');
  });

  it("CTR-T12b: status:'OPEN' calls openMonthUC with courseCycleId/year/month/userId", async () => {
    const ctrl = makeController();
    const body = { year: 2026, month: 6, status: 'OPEN' as const };

    const result = await ctrl.setMonthStatus('cc-1', mockUser, body);

    expect(ctrl.openMonthUC.execute).toHaveBeenCalledWith({
      courseCycleId: 'cc-1', year: 2026, month: 6, userId: 'u-1',
    });
    expect(ctrl.closeMonthUC.execute).not.toHaveBeenCalled();
    expect(result.data.status).toBe('OPEN');
  });
});
