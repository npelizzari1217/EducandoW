/**
 * GenerateAsistenciaMensualPdfUseCase — unit tests, Por Materia scope (PR3c, T3.8).
 *
 * Level resolution (Riesgo C): materiaXCursoXCiclo → courseCycle → level.
 * Totals/días-hábiles wiring identical to General (Scenario P2-11).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ok, err, DomainError, MateriaXCursoXCicloNotFoundError } from '@educandow/domain';
import { ForbiddenError } from '../../shared/errors/forbidden-error';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import { TenantClientUnavailableError } from '../../shared/errors/infrastructure-errors';
import {
  AttendanceType,
  AttendanceBehaviorValue,
  DayMap,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  Id,
} from '@educandow/domain';
import type { EnrichedMateriaAttendance } from '@educandow/domain';
import { PdfError } from '../../shared/errors/pdf.error';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn(),
  },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GenerateAsistenciaMensualPdfUseCase: any;
beforeAll(async () => {
  const mod = await import('../generate-asistencia-mensual-pdf.use-case');
  GenerateAsistenciaMensualPdfUseCase = mod.GenerateAsistenciaMensualPdfUseCase;
});

const MXCC_ID = 'mxcc-1';
const CC_ID = 'cc-1';
const CYCLE_ID = 'cycle-1';
const YEAR = 2026;
const MONTH = 7;
const GRUPO_ID = 'grp-1';

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
): EnrichedMateriaAttendance {
  return {
    attendance: AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(`row-${studentId}`),
      materiaXCursoXCicloId: MXCC_ID,
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
];

function makeUC({
  materiaExists = true,
  ccExists = true,
  ccLevel = 2,
  ccCourseName = '5° A',
  subjectName = 'Matemática',
  enrichedRows = [makeEnrichedRow('stu-1', 'García, Ana', { '1': 'T' })],
  catalogTypes = CATALOG_TYPES,
  docenteExists = true,
  teacherGroups = [{ id: GRUPO_ID, docenteXCicloId: 'dxc-1' }],
  studentIdsInGroup = ['stu-1'],
}: {
  materiaExists?: boolean;
  ccExists?: boolean;
  ccLevel?: number;
  ccCourseName?: string;
  subjectName?: string;
  enrichedRows?: EnrichedMateriaAttendance[];
  catalogTypes?: AttendanceType[];
  docenteExists?: boolean;
  teacherGroups?: { id: string; docenteXCicloId: string }[];
  studentIdsInGroup?: string[];
} = {}) {
  const mockClient = {
    materiaXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue(
        materiaExists ? { courseCycleId: CC_ID, subject: { name: subjectName } } : null,
      ),
    },
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(
        ccExists ? { level: ccLevel, courseName: ccCourseName, cycleId: CYCLE_ID } : null,
      ),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);
  vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-1');

  const generalRepo = { findByScopeAndMonthEnriched: vi.fn() };
  const materiaRepo = {
    findByScopeAndMonthEnriched: vi.fn().mockImplementation(
      (_id: string, _y: number, _m: number, studentIds?: string[]) =>
        Promise.resolve(studentIds ? enrichedRows.filter((r) => studentIds.includes(r.attendance.studentId)) : enrichedRows),
    ),
  };
  const attendanceTypeRepo = { list: vi.fn().mockResolvedValue(catalogTypes) };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: 'dxc-1', userId: 'u1', cycleId: CYCLE_ID } : null,
    ),
  };
  const asignacionRepo = { isPreceptor: vi.fn() };
  const grupoRepo = { findGroupsForDocente: vi.fn().mockResolvedValue(teacherGroups) };
  const alumnosXGrupoRepo = {
    findStudentIdsByGrupoIds: vi.fn().mockResolvedValue(studentIdsInGroup),
  };
  const pdfGenerator = { generatePdf: vi.fn().mockResolvedValue(ok(Buffer.from('PDF'))) };
  const prisma = {
    getMasterClient: vi.fn().mockReturnValue({
      institution: { findUnique: vi.fn().mockResolvedValue({ name: 'Escuela Test', logoUrl: null }) },
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

  return { uc, materiaRepo, attendanceTypeRepo, docenteRepo, grupoRepo, alumnosXGrupoRepo, pdfGenerator };
}

describe('GenerateAsistenciaMensualPdfUseCase — executeMateria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves level via materiaXCursoXCiclo → courseCycle → level, and calls generatePdf landscape', async () => {
    const { uc, attendanceTypeRepo, pdfGenerator } = makeUC({ ccLevel: 3 });

    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID,
      year: YEAR,
      month: MONTH,
      userId: 'u1',
      userRoles: ['ADMIN'],
    });

    expect(attendanceTypeRepo.list).toHaveBeenCalledWith({ level: 3 });
    expect(pdfGenerator.generatePdf).toHaveBeenCalledOnce();
    const [html, options] = pdfGenerator.generatePdf.mock.calls[0];
    expect(options).toEqual({ landscape: true });
    expect(html).toContain('Matemática');
    expect(html).toContain('5° A');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(Buffer);
  });

  it('produces identical totals/días-hábiles wiring as General given equivalent data (P2-11)', async () => {
    const { uc, pdfGenerator } = makeUC({
      enrichedRows: [makeEnrichedRow('stu-1', 'García, Ana', { '1': 'T', '2': 'T' })],
    });
    await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });
    const [html] = pdfGenerator.generatePdf.mock.calls[0];
    expect(html).toContain('Días hábiles: 31');
  });

  it('applies optional grupoId filter (ADR-2 parity)', async () => {
    const { uc, materiaRepo, alumnosXGrupoRepo } = makeUC({
      studentIdsInGroup: ['stu-1'],
    });
    await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, grupoId: GRUPO_ID, userId: 'u1', userRoles: ['ADMIN'],
    });
    expect(alumnosXGrupoRepo.findStudentIdsByGrupoIds).toHaveBeenCalledWith([GRUPO_ID]);
    expect(materiaRepo.findByScopeAndMonthEnriched).toHaveBeenCalledWith(MXCC_ID, YEAR, MONTH, ['stu-1']);
  });

  it('unknown materiaXCursoXCicloId → err(MateriaXCursoXCicloNotFoundError) instanceof DomainError, code MATERIA_X_CURSO_X_CICLO_NOT_FOUND', async () => {
    const { uc } = makeUC({ materiaExists: false });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    expect(result.unwrapErr()).toBeInstanceOf(MateriaXCursoXCicloNotFoundError);
    expect(result.unwrapErr()).toMatchObject({ code: 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND' });
  });

  it('tenant client unavailable → err(TenantClientUnavailableError) instanceof InfrastructureError, code TENANT_CLIENT_UNAVAILABLE, httpStatus 500', async () => {
    const { uc } = makeUC();
    vi.mocked(TenantContext.getClient).mockReturnValue(undefined as never);
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InfrastructureError);
    expect(result.unwrapErr()).toBeInstanceOf(TenantClientUnavailableError);
    expect(result.unwrapErr()).toMatchObject({ code: 'TENANT_CLIENT_UNAVAILABLE', httpStatus: 500 });
  });

  it('teacher with a group in the materia → allowed (Door 2)', async () => {
    const { uc } = makeUC({ teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: 'dxc-1' }] });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'],
    });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(Buffer);
  });

  it('teacher with no group in the materia → err(ForbiddenError)', async () => {
    const { uc } = makeUC({ teacherGroups: [] });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('non-admin, not a DocenteXCiclo in this cycle → err(ForbiddenError)', async () => {
    const { uc } = makeUC({ docenteExists: false });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
  });

  it('non-admin, materiaXCursoXCiclo not found (Door 2) → err(ForbiddenError), fails closed', async () => {
    const { uc, docenteRepo, grupoRepo } = makeUC({ materiaExists: false });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(result.unwrapErr()).toMatchObject({ message: expect.stringContaining('MateriaXCursoXCiclo not found') });
    // Door 2 short-circuits before ever reaching the docente/group lookups.
    expect(docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
    expect(grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
  });

  it('non-admin, courseCycle not found for the materia (Door 2) → err(ForbiddenError), fails closed', async () => {
    const { uc, docenteRepo, grupoRepo } = makeUC({ ccExists: false });
    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(result.unwrapErr()).toMatchObject({ message: expect.stringContaining('CourseCycle not found') });
    expect(docenteRepo.findByUserAndCycle).not.toHaveBeenCalled();
    expect(grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
  });

  // ── PPR-S4/S5 — Result propagation from the port ─────────────────────────

  it('(PPR-S4) executeMateria propagates err(PdfError) from the port without throwing', async () => {
    const { uc, pdfGenerator } = makeUC();
    const pdfError = new PdfError({ cause: new Error('boom') });
    pdfGenerator.generatePdf.mockResolvedValue(err(pdfError));

    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(pdfError);
  });

  it('(PPR-S5) executeMateria propagates ok(buffer) from the port with the same Buffer instance', async () => {
    const { uc, pdfGenerator } = makeUC();
    const buffer = Buffer.from('SPECIFIC-PDF-BYTES');
    pdfGenerator.generatePdf.mockResolvedValue(ok(buffer));

    const result = await uc.executeMateria({
      materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'],
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(buffer);
  });
});
