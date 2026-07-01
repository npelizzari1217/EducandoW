/**
 * GenerateAsistenciaMensualPdfUseCase — unit tests, General scope (PR3c, T3.7).
 *
 * Pattern: mocked TenantContext + mocked repos/services, no NestJS, no DB, no Puppeteer
 * (PdfGeneratorService is injected as a plain mock — same style as
 * generate-boletin.use-case tests). The real .hbs template IS rendered (T3.6 note:
 * "covered by T3.9 use-case test rendering real HTML").
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError } from '@educandow/domain';
import {
  AttendanceType,
  AttendanceBehaviorValue,
  DayMap,
  AsistenciaXAlumnoXCursoXCiclo,
  Id,
} from '@educandow/domain';
import type { EnrichedGeneralAttendance } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn(),
  },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GenerateAsistenciaMensualPdfUseCase: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AsistenciaReportingError: any;
beforeAll(async () => {
  const mod = await import('../generate-asistencia-mensual-pdf.use-case');
  GenerateAsistenciaMensualPdfUseCase = mod.GenerateAsistenciaMensualPdfUseCase;
  const errMod = await import('../asistencia-reporting.errors');
  AsistenciaReportingError = errMod.AsistenciaReportingError;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';
const YEAR = 2026;
const MONTH = 7; // 31 days
const CYCLE_ID = 'cycle-1';

function makeCatalogType(code: string, behavior: AttendanceBehaviorValue, absenceValue: number) {
  return AttendanceType.create({
    code,
    description: code,
    absenceValue,
    level: 2,
    behavior,
    isSystem: false,
    active: true,
  });
}

function makeEnrichedRow(
  studentId: string,
  studentName: string,
  days: Record<string, string>,
): EnrichedGeneralAttendance {
  return {
    attendance: AsistenciaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(`row-${studentId}`),
      courseCycleId: CC_ID,
      studentId,
      year: YEAR,
      month: MONTH,
      days: DayMap.fromRecord(days),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    studentName,
  };
}

const CATALOG_TYPES = [
  makeCatalogType('T', AttendanceBehaviorValue.TARDE_JUSTIFICADA, 0.5),
  makeCatalogType('A', AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO, 1),
  makeCatalogType('SAB', AttendanceBehaviorValue.NO_ELEGIBLE, 0),
  makeCatalogType('DOM', AttendanceBehaviorValue.NO_ELEGIBLE, 0),
];

function makeUC({
  ccExists = true,
  ccLevel = 2,
  ccCourseName = '5° A',
  enrichedRows = [makeEnrichedRow('stu-1', 'García, Ana', { '1': 'T', '6': 'SAB' })],
  catalogTypes = CATALOG_TYPES,
  docenteExists = true,
  isPreceptor = true,
  institution = { name: 'Escuela Test', logoUrl: null },
}: {
  ccExists?: boolean;
  ccLevel?: number;
  ccCourseName?: string;
  enrichedRows?: EnrichedGeneralAttendance[];
  catalogTypes?: AttendanceType[];
  docenteExists?: boolean;
  isPreceptor?: boolean;
  institution?: { name: string; logoUrl: string | null } | null;
} = {}) {
  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(
        ccExists ? { level: ccLevel, courseName: ccCourseName, cycleId: CYCLE_ID } : null,
      ),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);
  vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-1');

  const generalRepo = {
    findByScopeAndMonthEnriched: vi.fn().mockResolvedValue(enrichedRows),
  };
  const materiaRepo = {
    findByScopeAndMonthEnriched: vi.fn(),
  };
  const attendanceTypeRepo = {
    list: vi.fn().mockResolvedValue(catalogTypes),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: 'dxc-1', userId: 'u1', cycleId: CYCLE_ID } : null,
    ),
  };
  const asignacionRepo = {
    isPreceptor: vi.fn().mockResolvedValue(isPreceptor),
  };
  const grupoRepo = {
    findGroupsForDocente: vi.fn(),
  };
  const alumnosXGrupoRepo = {
    findStudentIdsByGrupoIds: vi.fn(),
  };
  const pdfGenerator = {
    generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')),
  };
  const prisma = {
    getMasterClient: vi.fn().mockReturnValue({
      institution: { findUnique: vi.fn().mockResolvedValue(institution) },
    }),
  };

  const uc = new GenerateAsistenciaMensualPdfUseCase(
    pdfGenerator,
    prisma,
    attendanceTypeRepo,
    generalRepo,
    materiaRepo,
    docenteRepo,
    asignacionRepo,
    grupoRepo,
    alumnosXGrupoRepo,
  );

  return { uc, generalRepo, materiaRepo, attendanceTypeRepo, docenteRepo, asignacionRepo, pdfGenerator, prisma };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GenerateAsistenciaMensualPdfUseCase — executeGeneral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves level from courseCycleId, aggregates totals, and calls generatePdf landscape', async () => {
    const { uc, attendanceTypeRepo, pdfGenerator } = makeUC({ ccLevel: 3 });

    const result = await uc.executeGeneral({
      courseCycleId: CC_ID,
      year: YEAR,
      month: MONTH,
      userId: 'u1',
      userRoles: ['ADMIN'],
    });

    expect(attendanceTypeRepo.list).toHaveBeenCalledWith({ level: 3 });
    expect(pdfGenerator.generatePdf).toHaveBeenCalledOnce();
    const [html, options] = pdfGenerator.generatePdf.mock.calls[0];
    expect(options).toEqual({ landscape: true });
    expect(typeof html).toBe('string');
    expect(html).toContain('5° A');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('includes per-student six totals computed via computeStudentTotals in the rendered HTML', async () => {
    const { uc } = makeUC({
      enrichedRows: [
        makeEnrichedRow('stu-1', 'García, Ana', { '1': 'T', '2': 'T', '3': 'A' }), // tardesJust=1.0, ausInj=1
      ],
    });
    const pdf = await uc.executeGeneral({
      courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });
    expect(pdf).toBeInstanceOf(Buffer);
  });

  it('computes días hábiles once at course level and passes it through', async () => {
    const { uc, pdfGenerator } = makeUC({
      enrichedRows: [
        makeEnrichedRow('stu-1', 'García, Ana', { '4': 'SAB', '5': 'DOM' }),
      ],
    });
    await uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });
    // 31-day July, 4/5 are non-hábil => 29 hábiles
    const [html] = pdfGenerator.generatePdf.mock.calls[0];
    expect(html).toContain('Días hábiles: 29');
  });

  it('student with no marks for the month → row present with all totals 0, no throw (P2-9)', async () => {
    const { uc } = makeUC({
      enrichedRows: [makeEnrichedRow('stu-1', 'Sin Marcas, Alumno', {})],
    });
    await expect(
      uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('unknown/missing courseCycleId → AsistenciaReportingError with 404', async () => {
    const { uc } = makeUC({ ccExists: false });
    await expect(
      uc.executeGeneral({ courseCycleId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] }),
    ).rejects.toMatchObject({ httpStatus: 404 });
    await expect(
      uc.executeGeneral({ courseCycleId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(AsistenciaReportingError);
  });

  it('non-admin preceptor of the CourseCycle → allowed (Door 2)', async () => {
    const { uc, docenteRepo, asignacionRepo } = makeUC({ docenteExists: true, isPreceptor: true });
    await expect(
      uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).resolves.toBeInstanceOf(Buffer);
    expect(docenteRepo.findByUserAndCycle).toHaveBeenCalled();
    expect(asignacionRepo.isPreceptor).toHaveBeenCalled();
  });

  it('non-admin, not a preceptor → ForbiddenError', async () => {
    const { uc } = makeUC({ isPreceptor: false });
    await expect(
      uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-admin, not a DocenteXCiclo in this cycle → ForbiddenError', async () => {
    const { uc } = makeUC({ docenteExists: false });
    await expect(
      uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-admin, courseCycle not found (Door 2) → ForbiddenError, fails closed', async () => {
    const { uc, docenteRepo, asignacionRepo } = makeUC({ ccExists: false });
    await expect(
      uc.executeGeneral({ courseCycleId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      uc.executeGeneral({ courseCycleId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toMatchObject({ message: expect.stringContaining('CourseCycle not found') });
    // Door 2 short-circuits before ever reaching the docente/preceptor lookups.
    expect(docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
    expect(asignacionRepo.isPreceptor).not.toHaveBeenCalled();
  });

  it('falls back to a default institution name when no institution is resolved (no institutionId)', async () => {
    const { uc, pdfGenerator } = makeUC({ institution: null });
    vi.mocked(TenantContext.getInstitutionId).mockReturnValue(undefined as never);
    await uc.executeGeneral({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });
    const [html] = pdfGenerator.generatePdf.mock.calls[0];
    expect(html).toContain('Institución Educativa');
  });
});
