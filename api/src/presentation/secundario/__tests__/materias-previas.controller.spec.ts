/**
 * PR5-T5 [RED] — MateriasPreviasController tests.
 *
 * Tests:
 *   POST /students/:studentId/materias-previas
 *     - valid body (condicion=PREVIA) → 201 { data }
 *     - condicion=REGULAR → 400 (domain ValidationError)
 *     - studentId not found → 404 (NotFoundError)
 *   GET /students/:studentId/materias-previas
 *     - → 200 { data: [...] }
 *     - ?academicYear=2025 → filtered array
 *     - cross-tenant studentId not found → 404
 *
 * Specs: MP-R1, MP-R6, MP-R8, MP-R9
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  ok,
  err,
  NotFoundError,
  ValidationError,
  SubjectFinalGradeCondicion,
  MateriaPreviaStatus,
} from '@educandow/domain';

let MateriasPreviasController: any;

beforeAll(async () => {
  const mod = await import('../materias-previas.controller');
  MateriasPreviasController = mod.MateriasPreviasController;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePrevia(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mp-uuid-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    originAcademicYear: '2025',
    condicion: SubjectFinalGradeCondicion.PREVIA,
    status: MateriaPreviaStatus.PENDIENTE,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeMateriaPrevia() {
  // Minimal mock of MateriaPrevia domain entity
  return {
    id: 'mp-uuid-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    originAcademicYear: '2025',
    condicion: SubjectFinalGradeCondicion.PREVIA,
    status: MateriaPreviaStatus.PENDIENTE,
    resolvedGradeCode: undefined,
    resolvedAt: undefined,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };
}

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(MateriasPreviasController.prototype);
  ctrl.upsertUC = overrides.upsertUC ?? {
    execute: vi.fn().mockResolvedValue(ok(makeMateriaPrevia())),
  };
  ctrl.listUC = overrides.listUC ?? {
    execute: vi.fn().mockResolvedValue(ok([makePrevia()])),
  };
  return ctrl;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /students/:studentId/materias-previas
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriasPreviasController — POST', () => {
  it('MP-R1: valid body (condicion=PREVIA) → 201 { data }', async () => {
    const ctrl = makeController();

    const response = await ctrl.create('student-1', {
      subjectId: 'subject-1',
      originAcademicYear: '2025',
      condicion: SubjectFinalGradeCondicion.PREVIA,
    });

    expect(response).toHaveProperty('data');
    expect(response.data.studentId).toBe('student-1');
  });

  it('MP-R1: condicion=LIBRE also accepted → 201 { data }', async () => {
    const ctrl = makeController({
      upsertUC: {
        execute: vi.fn().mockResolvedValue(ok({ ...makeMateriaPrevia(), condicion: SubjectFinalGradeCondicion.LIBRE })),
      },
    });

    const response = await ctrl.create('student-1', {
      subjectId: 'subject-1',
      originAcademicYear: '2025',
      condicion: SubjectFinalGradeCondicion.LIBRE,
    });

    expect(response).toHaveProperty('data');
  });

  it('MP-R2: condicion=REGULAR → ValidationError → 400', async () => {
    const ctrl = makeController({
      upsertUC: {
        execute: vi.fn().mockResolvedValue(err(new ValidationError('condicion=REGULAR not allowed for MateriaPrevia'))),
      },
    });

    await expect(
      ctrl.create('student-1', {
        subjectId: 'subject-1',
        originAcademicYear: '2025',
        condicion: SubjectFinalGradeCondicion.REGULAR,
      }),
    ).rejects.toThrow();
  });

  it('MP-R3: studentId not found → NotFoundError → 404', async () => {
    const ctrl = makeController({
      upsertUC: {
        execute: vi.fn().mockResolvedValue(err(new NotFoundError('Student', 'student-999'))),
      },
    });

    await expect(
      ctrl.create('student-999', {
        subjectId: 'subject-1',
        originAcademicYear: '2025',
        condicion: SubjectFinalGradeCondicion.PREVIA,
      }),
    ).rejects.toThrow();
  });

  it('cross-tenant: studentId not found → 404', async () => {
    const ctrl = makeController({
      upsertUC: {
        execute: vi.fn().mockResolvedValue(err(new NotFoundError('Student', 'cross-tenant-student'))),
      },
    });

    await expect(
      ctrl.create('cross-tenant-student', {
        subjectId: 'subject-1',
        originAcademicYear: '2025',
        condicion: SubjectFinalGradeCondicion.PREVIA,
      }),
    ).rejects.toThrow();
  });

  it('calls upsertUC with studentId merged from param + body fields', async () => {
    const executeMock = vi.fn().mockResolvedValue(ok(makeMateriaPrevia()));
    const ctrl = makeController({ upsertUC: { execute: executeMock } });

    await ctrl.create('student-1', {
      subjectId: 'subject-1',
      originAcademicYear: '2025',
      condicion: SubjectFinalGradeCondicion.PREVIA,
    });

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        subjectId: 'subject-1',
        originAcademicYear: '2025',
        condicion: SubjectFinalGradeCondicion.PREVIA,
      }),
    );
  });

  it('Zod validation pipe: invalid condicion → 400', async () => {
    const { ZodValidationPipe } = await import('../../shared/pipes/zod-validation.pipe');
    const { UpsertMateriaPreviaSchema } = await import('../dto/materias-previas.dto');
    const pipe = new ZodValidationPipe(UpsertMateriaPreviaSchema);

    expect(() =>
      pipe.transform(
        { subjectId: 's-1', originAcademicYear: '2025', condicion: 'INVALID' },
        {} as any,
      ),
    ).toThrow();
  });

  it('Zod validation pipe: missing subjectId → 400', async () => {
    const { ZodValidationPipe } = await import('../../shared/pipes/zod-validation.pipe');
    const { UpsertMateriaPreviaSchema } = await import('../dto/materias-previas.dto');
    const pipe = new ZodValidationPipe(UpsertMateriaPreviaSchema);

    expect(() =>
      pipe.transform(
        { originAcademicYear: '2025', condicion: SubjectFinalGradeCondicion.PREVIA },
        {} as any,
      ),
    ).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /students/:studentId/materias-previas
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriasPreviasController — GET', () => {
  it('MP-R6: GET without academicYear → 200 { data: [...] }', async () => {
    const ctrl = makeController();
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.list(user, 'student-1', undefined);

    expect(response).toHaveProperty('data');
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data[0].studentId).toBe('student-1');
  });

  it('MP-R9: GET with ?academicYear=2025 calls use case with academicYear filter', async () => {
    const executeMock = vi.fn().mockResolvedValue(ok([makePrevia()]));
    const ctrl = makeController({ listUC: { execute: executeMock } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await ctrl.list(user, 'student-1', '2025');

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        academicYear: '2025',
      }),
    );
  });

  it('MP-R8: GET without academicYear calls use case without academicYear', async () => {
    const executeMock = vi.fn().mockResolvedValue(ok([makePrevia()]));
    const ctrl = makeController({ listUC: { execute: executeMock } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await ctrl.list(user, 'student-1', undefined);

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
      }),
    );
  });

  it('empty list → 200 { data: [] } (never error)', async () => {
    const ctrl = makeController({
      listUC: { execute: vi.fn().mockResolvedValue(ok([])) },
    });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.list(user, 'student-1', undefined);

    expect(response).toEqual({ data: [] });
  });

  it('cross-tenant: studentId not found → 404', async () => {
    const ctrl = makeController({
      listUC: {
        execute: vi.fn().mockResolvedValue(err(new NotFoundError('Student', 'cross-tenant-student'))),
      },
    });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await expect(ctrl.list(user, 'cross-tenant-student', undefined)).rejects.toThrow();
  });
});
