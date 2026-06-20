import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PedagogyController } from '../pedagogy.controller';
import {
  ok, err, ValidationError, NotFoundError,
  CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo,
  CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError,
  ValueNotFoundError,
  PeriodLockedError,
  GradeScaleNotConfiguredError,
} from '@educandow/domain';
import type { CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos } from '@educandow/domain';
import { CreateSubjectCompetencySchema, CopySubjectCompetenciesSchema, UpdatePeriodGradeSchema } from '../dto/competency.dto';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';

// Mock TenantContext so the controller's pre-resolve clientCall is a no-op
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn().mockReturnValue(null),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal controller instance that bypasses the NestJS DI
// constructor and injects only the mocks needed for each test group.
// ---------------------------------------------------------------------------
function buildController(mocks: Record<string, unknown>): PedagogyController {
  const ctrl = Object.create(PedagogyController.prototype) as PedagogyController;
  for (const [key, value] of Object.entries(mocks)) {
    (ctrl as unknown as Record<string, unknown>)[key] = value;
  }
  return ctrl;
}

// ---------------------------------------------------------------------------
// DTO / Zod schema validation tests
// ---------------------------------------------------------------------------
describe('CreateSubjectCompetencySchema — ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(CreateSubjectCompetencySchema);

  it('rejects a body that sends subjectId instead of studyPlanSubjectId (→ HTTP 400 via pipe)', () => {
    expect(() => pipe.transform({ subjectId: 'sub-1', name: 'Comunicación oral' })).toThrow();
  });

  it('rejects a body missing the name field', () => {
    expect(() => pipe.transform({ studyPlanSubjectId: 'sps-1' })).toThrow();
  });

  it('accepts a valid body', () => {
    expect(() => pipe.transform({ studyPlanSubjectId: 'sps-1', name: 'Comunicación oral' })).not.toThrow();
  });
});

describe('CopySubjectCompetenciesSchema — ZodValidationPipe', () => {
  // This block will be RED until CopySubjectCompetenciesSchema is exported from competency.dto.ts
  const pipe = new ZodValidationPipe(CopySubjectCompetenciesSchema);

  it('rejects a body missing sourceStudyPlanSubjectId', () => {
    expect(() => pipe.transform({ targetStudyPlanSubjectId: 'sps-2' })).toThrow();
  });

  it('rejects a body missing targetStudyPlanSubjectId', () => {
    expect(() => pipe.transform({ sourceStudyPlanSubjectId: 'sps-1' })).toThrow();
  });

  it('rejects an empty body', () => {
    expect(() => pipe.transform({})).toThrow();
  });

  it('accepts a valid body with both IDs', () => {
    expect(() =>
      pipe.transform({ sourceStudyPlanSubjectId: 'sps-1', targetStudyPlanSubjectId: 'sps-2' }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Controller method tests — manual validation paths
// ---------------------------------------------------------------------------
describe('PedagogyController — GET /subject-competencies', () => {
  it('throws HTTP 400 when studyPlanSubjectId query param is absent', async () => {
    const ctrl = buildController({});

    await expect(ctrl.listCompetencies(undefined as unknown as string)).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.listCompetencies(undefined as unknown as string);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

describe('PedagogyController — GET /competency-valuations', () => {
  it('throws HTTP 400 when studyPlanSubjectId query param is absent', async () => {
    const ctrl = buildController({});

    await expect(
      ctrl.listValuations('student-1', undefined as unknown as string, undefined as unknown as string),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.listValuations('student-1', undefined as unknown as string, undefined as unknown as string);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

// ---------------------------------------------------------------------------
// Controller method tests — POST /subject-competencies/copy
// These will be RED until copyCompetencies() is added to the controller.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Controller method tests — POST /subject-competencies (W1: duplicate → 400)
// ---------------------------------------------------------------------------
describe('PedagogyController — POST /subject-competencies duplicate name', () => {
  const mockCreateUC = { execute: vi.fn() };
  let ctrl: PedagogyController;

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = buildController({ createCompUC: mockCreateUC });
  });

  it('throws HTTP 400 (not 409) when UC returns duplicate-name error (W1)', async () => {
    mockCreateUC.execute.mockResolvedValue(
      err(new ValidationError('Ya existe una competencia con el nombre "Lectura" para este plan')),
    );

    await expect(
      ctrl.createCompetency({ studyPlanSubjectId: 'sps-1', name: 'Lectura' }),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.createCompetency({ studyPlanSubjectId: 'sps-1', name: 'Lectura' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

// ---------------------------------------------------------------------------
// Controller method tests — PATCH /subject-competencies/:uuid (W2: 400/404)
// ---------------------------------------------------------------------------
describe('PedagogyController — PATCH /subject-competencies/:uuid', () => {
  const mockUpdateUC = { execute: vi.fn() };
  let ctrl: PedagogyController;

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = buildController({ updateCompUC: mockUpdateUC });
  });

  it('throws HTTP 404 when UC returns NotFoundError (W2)', async () => {
    mockUpdateUC.execute.mockResolvedValue(
      err(new NotFoundError('Competencia', 'some-uuid')),
    );

    await expect(
      ctrl.updateCompetency('some-uuid', { name: 'Lectura' }),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.updateCompetency('some-uuid', { name: 'Lectura' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('throws HTTP 400 when UC returns ValidationError for duplicate name (W2)', async () => {
    mockUpdateUC.execute.mockResolvedValue(
      err(new ValidationError('Ya existe una competencia con el nombre "Lectura" para este plan')),
    );

    await expect(
      ctrl.updateCompetency('some-uuid', { name: 'Lectura' }),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.updateCompetency('some-uuid', { name: 'Lectura' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

// ---------------------------------------------------------------------------
// DTO — UpdatePeriodGradeSchema
// ---------------------------------------------------------------------------
describe('UpdatePeriodGradeSchema — ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(UpdatePeriodGradeSchema);

  it('accepts a valid UUID gradeScaleValueId', () => {
    expect(() => pipe.transform({ gradeScaleValueId: '123e4567-e89b-12d3-a456-426614174000' })).not.toThrow();
  });

  it('accepts null gradeScaleValueId (clear grade)', () => {
    expect(() => pipe.transform({ gradeScaleValueId: null })).not.toThrow();
  });

  it('rejects a non-UUID string', () => {
    expect(() => pipe.transform({ gradeScaleValueId: 'not-a-uuid' })).toThrow();
  });

  it('rejects empty body (neither gradeScaleValueId nor imprimible provided)', () => {
    expect(() => pipe.transform({})).toThrow();
  });

  it('accepts { imprimible: true } alone (imprimible-only toggle)', () => {
    expect(() => pipe.transform({ imprimible: true })).not.toThrow();
  });

  it('accepts { imprimible: false } alone', () => {
    expect(() => pipe.transform({ imprimible: false })).not.toThrow();
  });

  it('accepts both gradeScaleValueId and imprimible together', () => {
    expect(() =>
      pipe.transform({ gradeScaleValueId: '123e4567-e89b-12d3-a456-426614174000', imprimible: true }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Controller — PATCH /competency-valuations/:uuid/periods/:periodItemId
// ---------------------------------------------------------------------------
describe('PedagogyController — PATCH /competency-valuations/:uuid/periods/:periodItemId', () => {
  const mockGradePeriodUC = { execute: vi.fn() };
  const mockBoletinInvalidation = { invalidateForStudent: vi.fn().mockResolvedValue(undefined) };
  let ctrl: PedagogyController;

  function makeChild(): CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo {
    return CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: false,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = buildController({
      gradePeriodUC: mockGradePeriodUC,
      boletinInvalidation: mockBoletinInvalidation,
    });
  });

  it('returns HTTP 200 with period valuation data on success', async () => {
    mockGradePeriodUC.execute.mockResolvedValue(ok(makeChild()));

    const result = await ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a' });

    expect(result).toEqual({
      data: {
        id: 'child-1',
        valuationId: 'v-1',
        periodItemId: 'item-7',
        gradeScaleValueId: 'gsv-a',
        gradeCode: 'MB',
        internalStatus: 'APROBADO',
        modificable: true,
        imprimible: false,
      },
    });
    expect(mockGradePeriodUC.execute).toHaveBeenCalledWith({
      valuationUuid: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      imprimible: undefined,
    });
  });

  it('CTL-IMP-1: forwards imprimible=true to the use case when present in body', async () => {
    const childWithImprimible = CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: true,
    });
    mockGradePeriodUC.execute.mockResolvedValue(ok(childWithImprimible));

    const result = await ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a', imprimible: true });

    expect(result.data.imprimible).toBe(true);
    expect(mockGradePeriodUC.execute).toHaveBeenCalledWith({
      valuationUuid: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      imprimible: true,
    });
  });

  it('CTL-IMP-2: imprimible-only body (no gradeScaleValueId) forwards to use case', async () => {
    const childImprimibleOnly = CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      modificable: true,
      imprimible: true,
    });
    mockGradePeriodUC.execute.mockResolvedValue(ok(childImprimibleOnly));

    const result = await ctrl.gradePeriod('v-1', 'item-7', { imprimible: true });

    expect(result.data.imprimible).toBe(true);
    expect(mockGradePeriodUC.execute).toHaveBeenCalledWith({
      valuationUuid: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: undefined,
      imprimible: true,
    });
  });

  it('returns HTTP 404 when UC returns CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError', async () => {
    mockGradePeriodUC.execute.mockResolvedValue(
      err(new CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError('v-nonexistent')),
    );

    await expect(ctrl.gradePeriod('v-nonexistent', 'item-7', { gradeScaleValueId: 'gsv-a' })).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.gradePeriod('v-nonexistent', 'item-7', { gradeScaleValueId: 'gsv-a' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('returns HTTP 404 when UC returns ValueNotFoundError', async () => {
    mockGradePeriodUC.execute.mockResolvedValue(
      err(new ValueNotFoundError('gsv-unknown')),
    );

    await expect(ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-unknown' })).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-unknown' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('returns HTTP 400 when UC returns PeriodLockedError', async () => {
    mockGradePeriodUC.execute.mockResolvedValue(
      err(new PeriodLockedError('item-7')),
    );

    await expect(ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a' })).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('returns HTTP 400 when UC returns GradeScaleNotConfiguredError', async () => {
    mockGradePeriodUC.execute.mockResolvedValue(
      err(new GradeScaleNotConfiguredError(1, 0)),
    );

    await expect(ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a' })).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.gradePeriod('v-1', 'item-7', { gradeScaleValueId: 'gsv-a' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

// ---------------------------------------------------------------------------

describe('PedagogyController — POST /subject-competencies/copy', () => {
  const mockCopyUC = { execute: vi.fn() };
  let ctrl: PedagogyController;

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = buildController({ copyCompUC: mockCopyUC });
  });

  it('returns HTTP 200 with { data: { copied, skipped } } on success', async () => {
    mockCopyUC.execute.mockResolvedValue(ok({ copied: 2, skipped: 0 }));

    const result = await ctrl.copyCompetencies({
      sourceStudyPlanSubjectId: 'sps-1',
      targetStudyPlanSubjectId: 'sps-2',
    });

    expect(result).toEqual({ data: { copied: 2, skipped: 0 } });
    expect(mockCopyUC.execute).toHaveBeenCalledWith({
      sourceStudyPlanSubjectId: 'sps-1',
      targetStudyPlanSubjectId: 'sps-2',
    });
  });

  it('returns HTTP 200 with partial { copied: 1, skipped: 1 } on partial copy', async () => {
    mockCopyUC.execute.mockResolvedValue(ok({ copied: 1, skipped: 1 }));

    const result = await ctrl.copyCompetencies({
      sourceStudyPlanSubjectId: 'sps-1',
      targetStudyPlanSubjectId: 'sps-2',
    });

    expect(result).toEqual({ data: { copied: 1, skipped: 1 } });
  });

  it('throws HTTP 400 when UC returns err (e.g. source === target)', async () => {
    mockCopyUC.execute.mockResolvedValue(
      err(new ValidationError('El origen y destino no pueden ser el mismo plan de estudio de materia')),
    );

    await expect(
      ctrl.copyCompetencies({ sourceStudyPlanSubjectId: 'sps-1', targetStudyPlanSubjectId: 'sps-1' }),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.copyCompetencies({ sourceStudyPlanSubjectId: 'sps-1', targetStudyPlanSubjectId: 'sps-1' });
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

// ---------------------------------------------------------------------------
// Controller — GET /competency-valuations — bulk read branch (1a-T4)
// BVR-1, BVR-2, BVR-3, BVR-4
// ---------------------------------------------------------------------------

describe('PedagogyController — GET /competency-valuations (bulk-read branch)', () => {
  const mockBulkUC = { execute: vi.fn() };
  let ctrl: PedagogyController;

  function makeRow(id = 'v-1'): CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos {
    return {
      valuationId:      id,
      studentId:        's-1',
      competencyId:     'c-1',
      competencyName:   'Competencia 1',
      periodValuations: [],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = buildController({ listBulkValUC: mockBulkUC });
  });

  it('BVR-2: throws HTTP 400 when only studyPlanSubjectId provided (no courseCycleId, no studentId)', async () => {
    // No courseCycleId → legacy branch → no studentId → 400
    await expect(
      ctrl.listValuations(undefined as unknown as string, 'sps-1', undefined as unknown as string),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.listValuations(undefined as unknown as string, 'sps-1', undefined as unknown as string);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('BVR-3: throws HTTP 400 when courseCycleId present but studyPlanSubjectId missing', async () => {
    await expect(
      ctrl.listValuations(undefined as unknown as string, undefined as unknown as string, 'cc-1'),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await ctrl.listValuations(undefined as unknown as string, undefined as unknown as string, 'cc-1');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('BVR-1: returns 200 with { data: [...] } when both courseCycleId + studyPlanSubjectId present', async () => {
    mockBulkUC.execute.mockResolvedValue([makeRow()]);

    const result = await ctrl.listValuations(undefined as unknown as string, 'sps-1', 'cc-1');

    expect(result).toEqual({
      data: [
        {
          valuationId:      'v-1',
          studentId:        's-1',
          competencyId:     'c-1',
          periodValuations: [],
        },
      ],
    });
    expect(mockBulkUC.execute).toHaveBeenCalledWith({
      courseCycleId:      'cc-1',
      studyPlanSubjectId: 'sps-1',
    });
  });

  it('BVR-4: returns 200 with { data: [] } when no valuations found (not 404)', async () => {
    mockBulkUC.execute.mockResolvedValue([]);

    const result = await ctrl.listValuations(undefined as unknown as string, 'sps-1', 'cc-new');

    expect(result).toEqual({ data: [] });
  });

  it('legacy studentId branch still works when studentId present (backward compat)', async () => {
    const mockListValUC = { execute: vi.fn().mockResolvedValue([]) };
    const legacyCtrl = buildController({ listValUC: mockListValUC });

    const result = await legacyCtrl.listValuations('student-1', 'sps-1', undefined as unknown as string);

    expect(result).toEqual({ data: [] });
    expect(mockListValUC.execute).toHaveBeenCalledWith('student-1', 'sps-1');
  });
});
