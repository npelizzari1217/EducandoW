import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { resolveLogoDataUri } from '../../infrastructure/reporting/resolve-logo-data-uri';
import type { DatosConstancia } from './templates/constancia.template';
import { ConstanciaError } from './templates/constancia.template';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Parses "YYYY-MM-DD" into "D de mes de YYYY" (es-AR long format).
 * Uses string splitting — NOT new Date(iso) — to avoid UTC-to-local timezone
 * shift that would change the displayed date when the server runs in UTC.
 */
function parseFechaEmision(fechaIso: string): string {
  const [yyyy, mm, dd] = fechaIso.split('-');
  const mesNombre = MESES_ES[parseInt(mm, 10) - 1] ?? mm;
  return `${parseInt(dd, 10)} de ${mesNombre} de ${yyyy}`;
}

/** Maps level code (base 1-4 or decade 10-49) to human-readable nivel name. */
function resolveLevelName(level: number): string {
  const decade = level >= 10 ? Math.floor(level / 10) : level;
  const names: Record<number, string> = {
    1: 'Inicial',
    2: 'Primario',
    3: 'Secundario',
    4: 'Terciario',
  };
  return names[decade] ?? `Nivel ${level}`;
}

// ── Use Case ───────────────────────────────────────────────────────────────────

export interface ConstanciaInput {
  destinatario: string;
  fechaEmision: string; // YYYY-MM-DD
}

/**
 * GenerateConstanciaRegularUseCase — generates a constancia de alumno regular PDF.
 *
 * Stateless (no cache, no disk write). Inputs (destinatario, fechaEmision) vary
 * per request, so caching would produce wrong documents.
 *
 * Data flow:
 *   axcc → student (eligibility) → courseCycle + course + cycle → institution (master)
 *   → resolveLogoDataUri → DatosConstancia → HBS template → Puppeteer PDF → Buffer
 */
@Injectable()
export class GenerateConstanciaRegularUseCase {
  private readonly logger = new Logger(GenerateConstanciaRegularUseCase.name);
  private readonly template: HandlebarsTemplateDelegate<DatosConstancia> | null = null;

  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly prisma: PrismaService,
  ) {
    // Sentinel-based template resolution (matches boletin use case pattern).
    // In dev __dirname = api/src/application/reportes → 2 levels up = api/src/
    // In prod (dist) __dirname = api/dist/application/reportes → probe deeper.
    const TEMPLATE_SUBPATH = 'infrastructure/reporting/html-templates';
    const candidateDirs = [
      path.resolve(__dirname, '../../', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../../src', TEMPLATE_SUBPATH),
    ];
    const sentinel = 'constancia-regular.hbs';
    const templateDir =
      candidateDirs.find((d) => fs.existsSync(path.join(d, sentinel))) ?? candidateDirs[0];
    const templatePath = path.join(templateDir, sentinel);
    if (fs.existsSync(templatePath)) {
      const source = fs.readFileSync(templatePath, 'utf-8');
      this.template = Handlebars.compile<DatosConstancia>(source);
    }
  }

  async execute(axccId: string, input: ConstanciaInput): Promise<Buffer> {
    const tenantClient = TenantContext.getClient();
    if (!tenantClient) {
      throw new ConstanciaError('No tenant context available', 'INTERNAL_ERROR', 500);
    }

    // ── Step 1: Fetch AlumnosXCursoXCiclo ────────────────────────────────────
    const axcc = await (tenantClient as any).alumnosXCursoXCiclo.findUnique({
      where: { id: axccId },
    });
    if (!axcc) {
      throw new ConstanciaError(
        'AlumnosXCursoXCiclo no encontrado',
        'AXCC_NOT_FOUND',
        404,
      );
    }

    // ── Step 2: Fetch Student + eligibility check ────────────────────────────
    const student = await (tenantClient as any).student.findUnique({
      where: { id: axcc.studentId },
    });
    if (student?.fechaDePase != null) {
      throw new ConstanciaError(
        'El alumno tiene fecha de pase asignada y no puede recibir constancia de alumno regular',
        'STUDENT_NOT_ELIGIBLE',
        422,
      );
    }

    // ── Step 3: Fetch CourseCycle → CourseSection (grade/division) + AcademicCycle (name) ──
    const cc = await (tenantClient as any).courseCycle.findUnique({
      where: { uuid: axcc.courseCycleId },
      include: { course: true, cycle: true },
    });

    // ── Step 4: Fetch Institution from master ────────────────────────────────
    const institutionId = TenantContext.getInstitutionId();
    const institution = institutionId
      ? await this.prisma.getMasterClient().institution.findUnique({
          where: { id: institutionId },
        })
      : null;

    // ── Step 5: Resolve logo as base64 data-URI (optional, never blocks PDF) ─
    const logoDataUri = await resolveLogoDataUri(institution?.logoUrl ?? null);

    // ── Step 6: Parse fechaEmision without TZ shift ──────────────────────────
    const fechaEmisionLarga = parseFechaEmision(input.fechaEmision);

    // ── Step 7: Assemble DatosConstancia (4 data groups) ────────────────────
    const nivel = resolveLevelName(cc?.level ?? 0);
    const datos: DatosConstancia = {
      // Group B — Alumno
      alumnoApellido: (student as any)?.lastName ?? '',
      alumnoNombre: (student as any)?.firstName ?? '',
      alumnoDni: (student as any)?.dni ?? '',
      // Group A — Institución
      institucionNombre: institution?.name ?? '',
      cue: institution?.cue ?? null,
      localidad: institution?.city ?? null,
      provincia: (institution as any)?.province ?? null,
      logoDataUri,
      // Group C — Académico
      nivel,
      grado: (cc?.course as any)?.grade ?? null,
      division: (cc?.course as any)?.division ?? null,
      cicloLectivo: (cc?.cycle as any)?.name ?? '',
      // Group D — Validación
      destinatario: input.destinatario,
      fechaEmisionLarga,
    };

    // ── Step 8: Render template ──────────────────────────────────────────────
    if (!this.template) {
      throw new ConstanciaError(
        'Template constancia-regular.hbs no encontrado',
        'TEMPLATE_NOT_FOUND',
        500,
      );
    }
    const html = this.template(datos);

    // ── Step 9: Generate PDF (stateless — no disk, no cache) ─────────────────
    this.logger.log(
      `Generando constancia regular para AlumnosXCursoXCiclo ${axccId} (${datos.alumnoApellido}, ${datos.alumnoNombre})`,
    );
    return this.pdfGenerator.generatePdf(html);
  }
}
