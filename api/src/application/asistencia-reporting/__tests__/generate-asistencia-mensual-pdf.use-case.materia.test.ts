/**
 * GenerateAsistenciaMensualPdfUseCase — unit tests, Por Materia scope (PR3c, T3.8).
 *
 * Level resolution (Riesgo C): materiaXCursoXCiclo → courseCycle → level.
 * Totals/días-hábiles wiring identical to General (Scenario P2-11).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError } from '@educandow/domain';
import {
  AttendanceType,
  AttendanceBehaviorValue,
  DayMap,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  Id,
} from '@educandow/domain';
import type { EnrichedMateriaAttendance } from '@educandow/domain';

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
      findUnique: vi.fn().mockResolvedValue({ level: ccLevel, courseName: ccCourseName, cycleId: CYCLE_ID }),
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
  const pdfGenerator = { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
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
    expect(result).toBeInstanceOf(Buffer);
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

  it('unknown materiaXCursoXCicloId → same error contract as General (404)', async () => {
    const { uc } = makeUC({ materiaExists: false });
    await expect(
      uc.executeMateria({ materiaXCursoXCicloId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(AsistenciaReportingError);
    await expect(
      uc.executeMateria({ materiaXCursoXCicloId: 'nope', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('teacher with a group in the materia → allowed (Door 2)', async () => {
    const { uc } = makeUC({ teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: 'dxc-1' }] });
    await expect(
      uc.executeMateria({ materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('teacher with no group in the materia → ForbiddenError', async () => {
    const { uc } = makeUC({ teacherGroups: [] });
    await expect(
      uc.executeMateria({ materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-admin, not a DocenteXCiclo in this cycle → ForbiddenError', async () => {
    const { uc } = makeUC({ docenteExists: false });
    await expect(
      uc.executeMateria({ materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
