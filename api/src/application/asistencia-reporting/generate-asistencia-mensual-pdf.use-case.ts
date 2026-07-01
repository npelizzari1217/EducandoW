/**
 * GenerateAsistenciaMensualPdfUseCase — application use-case (PR3c).
 *
 * Generates the "Planilla de Asistencia Mensual" PDF (landscape, A4) for a
 * CourseCycle+month (General) or a MateriaXCursoXCiclo+month (Por Materia).
 *
 * Data flow (ADR-08):
 *   resolve level (General: courseCycle.level ; Materia: materiaXCursoXCiclo →
 *   courseCycle → level, Riesgo C) → build AttendanceType catalog for that level
 *   (attendanceTypeRepo.list({ level })) → fetch enriched rows via the EXISTING
 *   findByScopeAndMonthEnriched repo method (general or materia) → per-student
 *   computeStudentTotals + course-level computeDiasHabiles (packages/domain
 *   asistencia-totals, PR3a) → assemble the view-model documented in the .hbs
 *   comment header (PR3b) → Handlebars render → PdfGeneratorService.generatePdf
 *   with { landscape: true } (PR3b).
 *
 * Authorization (Door 2, same pattern as ListGeneralAttendanceUseCase /
 * ListSubjectAttendanceUseCase):
 *   D3 — SECRETARIO/DIRECTOR/ADMIN/ROOT: full scope
 *   General — Door 2: preceptor of the CourseCycle
 *   Materia — Door 2: teacher owns at least one group for this materia
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import {
  resolveAccessScope,
  ForbiddenError,
  computeStudentTotals,
  computeDiasHabiles,
  daysInMonth,
} from '@educandow/domain';
import type {
  AttendanceTypeRepository,
  AsistenciaGeneralRepository,
  AsistenciaMateriaRepository,
  EnrichedGeneralAttendance,
  EnrichedMateriaAttendance,
  AttendanceTypeCatalog,
  DocenteXCicloRepository,
  AsignacionCursoXCicloRepository,
  GrupoRepository,
  AlumnosXGrupoRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { resolveLogoDataUri } from '../../infrastructure/reporting/resolve-logo-data-uri';
import { AsistenciaReportingError } from './asistencia-reporting.errors';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function mesAnioLabel(year: number, month: number): string {
  return `${MESES_ES[month - 1] ?? month} ${year}`;
}

interface AlumnoPrintRow {
  apellidoNombre: string;
  days: Record<string, string>;
  tardesJust: number;
  tardesInj: number;
  totalTardes: number;
  ausJust: number;
  ausInj: number;
  ausTotal: number;
}

interface AsistenciaMensualTemplateContext {
  institucionNombre: string;
  logoDataUri?: string | null;
  scopeLabel: string;
  mesAnioLabel: string;
  diasHabiles: number;
  dayNumbers: number[];
  alumnos: AlumnoPrintRow[];
}

export interface GenerateAsistenciaGeneralInput {
  courseCycleId: string;
  year: number;
  month: number;
  userId: string;
  userRoles: string[];
}

export interface GenerateAsistenciaMateriaInput {
  materiaXCursoXCicloId: string;
  year: number;
  month: number;
  /** Optional group filter, mirrors ListSubjectAttendanceUseCase (ADR-2). */
  grupoId?: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class GenerateAsistenciaMensualPdfUseCase {
  private readonly logger = new Logger(GenerateAsistenciaMensualPdfUseCase.name);
  private readonly template: HandlebarsTemplateDelegate<AsistenciaMensualTemplateContext> | null = null;

  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly prisma: PrismaService,
    private readonly attendanceTypeRepo: AttendanceTypeRepository,
    private readonly generalRepo: AsistenciaGeneralRepository,
    private readonly materiaRepo: AsistenciaMateriaRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly asignacionRepo: AsignacionCursoXCicloRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository,
  ) {
    // Sentinel-based template resolution (matches generate-boletin.use-case pattern).
    const TEMPLATE_SUBPATH = 'infrastructure/reporting/html-templates';
    const candidateDirs = [
      path.resolve(__dirname, '../../', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../../src', TEMPLATE_SUBPATH),
    ];
    const sentinel = 'asistencia-mensual.hbs';
    const templateDir = candidateDirs.find((d) => fs.existsSync(path.join(d, sentinel))) ?? candidateDirs[0];
    const templatePath = path.join(templateDir, sentinel);
    if (fs.existsSync(templatePath)) {
      const source = fs.readFileSync(templatePath, 'utf-8');
      this.template = Handlebars.compile<AsistenciaMensualTemplateContext>(source);
    }
  }

  // ── General scope ────────────────────────────────────────────────────────

  async executeGeneral(input: GenerateAsistenciaGeneralInput): Promise<Buffer> {
    const { courseCycleId, year, month, userId, userRoles } = input;

    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      await this.checkDoor2General(courseCycleId, userId);
    }

    const client = this.tenantClient();
    const cc = await (client as any).courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { level: true, courseName: true },
    });
    if (!cc) {
      throw new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404);
    }

    const enrichedRows = await this.generalRepo.findByScopeAndMonthEnriched(
      courseCycleId, year, month, undefined,
    );

    return this.render({
      scopeLabel: cc.courseName as string,
      level: cc.level as number,
      year,
      month,
      enrichedRows,
    });
  }

  // ── Por Materia scope ────────────────────────────────────────────────────

  async executeMateria(input: GenerateAsistenciaMateriaInput): Promise<Buffer> {
    const { materiaXCursoXCicloId, year, month, grupoId, userId, userRoles } = input;

    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      await this.checkDoor2Materia(materiaXCursoXCicloId, userId);
    }

    const client = this.tenantClient();
    const materia = await (client as any).materiaXCursoXCiclo.findUnique({
      where: { id: materiaXCursoXCicloId },
      select: { courseCycleId: true, subject: { select: { name: true } } },
    });
    if (!materia) {
      throw new AsistenciaReportingError(
        'MateriaXCursoXCiclo no encontrada', 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND', 404,
      );
    }

    // Riesgo C: level resolved via materiaXCursoXCiclo → courseCycle → level.
    const cc = await (client as any).courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { level: true, courseName: true },
    });
    if (!cc) {
      throw new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404);
    }

    let studentIds: string[] | undefined;
    if (grupoId) {
      studentIds = await this.alumnosXGrupoRepo.findStudentIdsByGrupoIds([grupoId]);
    }

    const enrichedRows = await this.materiaRepo.findByScopeAndMonthEnriched(
      materiaXCursoXCicloId, year, month, studentIds,
    );

    const subjectName = (materia.subject as { name: string } | null)?.name ?? '';
    const scopeLabel = `${subjectName} — ${cc.courseName as string}`;

    return this.render({
      scopeLabel,
      level: cc.level as number,
      year,
      month,
      enrichedRows,
    });
  }

  // ── Shared render pipeline ───────────────────────────────────────────────

  private async render(params: {
    scopeLabel: string;
    level: number;
    year: number;
    month: number;
    enrichedRows: (EnrichedGeneralAttendance | EnrichedMateriaAttendance)[];
  }): Promise<Buffer> {
    if (!this.template) {
      throw new AsistenciaReportingError(
        'Template asistencia-mensual.hbs no encontrado', 'TEMPLATE_NOT_FOUND', 500,
      );
    }

    const { scopeLabel, level, year, month, enrichedRows } = params;

    const catalog = await this.buildCatalog(level);
    const dim = daysInMonth(year, month);
    const dayNumbers = Array.from({ length: dim }, (_, i) => i + 1);

    // Días hábiles is a course-level scalar (ADR-07): merge all rows' day-maps
    // into a single representative view (calendar/feriado marks are expected
    // to be identical across students within the same scope).
    const courseDayCodes: Record<string, string> = {};
    for (const row of enrichedRows) {
      const days = row.attendance.days.toJSON();
      for (const [day, code] of Object.entries(days)) {
        if (!(day in courseDayCodes)) courseDayCodes[day] = code;
      }
    }
    const diasHabiles = computeDiasHabiles(dim, courseDayCodes, catalog);

    const alumnos: AlumnoPrintRow[] = enrichedRows.map((row) => {
      const days = row.attendance.days.toJSON();
      return {
        apellidoNombre: row.studentName,
        days,
        ...computeStudentTotals(days, catalog),
      };
    });

    const { institucionNombre, logoDataUri } = await this.resolveInstitution();

    const context: AsistenciaMensualTemplateContext = {
      institucionNombre,
      logoDataUri,
      scopeLabel,
      mesAnioLabel: mesAnioLabel(year, month),
      diasHabiles,
      dayNumbers,
      alumnos,
    };

    const html = this.template(context);

    this.logger.log(`Generando asistencia mensual PDF — ${scopeLabel} (${mesAnioLabel(year, month)})`);
    return this.pdfGenerator.generatePdf(html, { landscape: true });
  }

  private async buildCatalog(level: number): Promise<AttendanceTypeCatalog> {
    const types = await this.attendanceTypeRepo.list({ level });
    const catalog: AttendanceTypeCatalog = new Map();
    for (const t of types) {
      catalog.set(t.code.get(), { behavior: t.behavior.get(), absenceValue: t.absenceValue });
    }
    return catalog;
  }

  private async resolveInstitution(): Promise<{ institucionNombre: string; logoDataUri: string | null }> {
    const institutionId = TenantContext.getInstitutionId();
    const institution = institutionId
      ? await this.prisma.getMasterClient().institution.findUnique({
          where: { id: institutionId },
          select: { name: true, logoUrl: true },
        })
      : null;
    const logoDataUri = await resolveLogoDataUri((institution as { logoUrl?: string | null } | null)?.logoUrl ?? null);
    return {
      institucionNombre: (institution as { name?: string } | null)?.name ?? 'Institución Educativa',
      logoDataUri,
    };
  }

  // ── Door 2 checks (mirror ListGeneralAttendanceUseCase / ListSubjectAttendanceUseCase) ──

  private async checkDoor2General(courseCycleId: string, userId: string): Promise<void> {
    const client = this.tenantClient();
    const cc = await (client as any).courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId as string);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    const isPreceptor = await this.asignacionRepo.isPreceptor(docente.id, courseCycleId);
    if (!isPreceptor) {
      throw new ForbiddenError('User is not a preceptor for this CursoXCiclo');
    }
  }

  private async checkDoor2Materia(materiaXCursoXCicloId: string, userId: string): Promise<void> {
    const client = this.tenantClient();
    const materia = await (client as any).materiaXCursoXCiclo.findUnique({
      where: { id: materiaXCursoXCicloId },
      select: { courseCycleId: true },
    });
    if (!materia) {
      throw new ForbiddenError('MateriaXCursoXCiclo not found — authorization failed');
    }

    const cc = await (client as any).courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId as string);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    const teacherGroups = await this.grupoRepo.findGroupsForDocente(docente.id, materiaXCursoXCicloId);
    if (teacherGroups.length === 0) {
      throw new ForbiddenError('User has no group assignment for this materia');
    }
  }

  private tenantClient() {
    const c = TenantContext.getClient();
    if (!c) {
      throw new AsistenciaReportingError('No tenant context available', 'INTERNAL_ERROR', 500);
    }
    return c;
  }
}
