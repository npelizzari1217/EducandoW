/**
 * GenerateAttendanceTypesPdfUseCase — application use-case (PR4, T22/T23).
 *
 * Generates the "Catálogo de Tipos de Asistencia" PDF (portrait, A4), respecting
 * EXACTLY the same level scope as ListAttendanceTypesUseCase (design.md §4.3,
 * ADD-3.1–ADD-3.4): reuses `resolveAccessScope` — does NOT reimplement the
 * modality-collapse logic (criterio transversal de aceptación de la spec).
 *
 * Data flow: resolveAccessScope(currentUser) → build filters (same rule as
 * ListAttendanceTypesUseCase.execute) → repo.list(filters) → sort rows (level,
 * then code) → resolve institución/logo (paridad con la `resolveInstitution`
 * privada de generate-asistencia-mensual-pdf.use-case.ts:287-300) → render
 * `attendance-types.hbs` con Handlebars → PdfGeneratorService.generatePdf(html)
 * SIN `landscape` (portrait A4, default del servicio — ADR-06).
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import {
  resolveAccessScope,
  AttendanceTypeLevelOutOfScopeError,
  AttendanceTypeRepository,
  AttendanceTypeFilters,
  AttendanceType,
  EducationalLevel,
  EducationalLevelCode,
} from '@educandow/domain';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../../infrastructure/reporting/pdf-generator.service';
import { resolveLogoDataUri } from '../../../infrastructure/reporting/resolve-logo-data-uri';
import type { AttendanceTypeCurrentUser } from './attendance-type.use-cases';

export interface GenerateAttendanceTypesPdfInput {
  level?: number;
  active?: boolean;
  currentUser: AttendanceTypeCurrentUser;
}

/** View-model de una fila del reporte (ADR-05: interface en application, no en domain). */
export interface AttendanceTypesReportRow {
  code: string;
  description: string;
  levelLabel: string;
  absenceValue: number;
  behavior: string;
  active: boolean;
}

export interface AttendanceTypesTemplateContext {
  institucionNombre: string;
  logoDataUri?: string | null;
  rows: AttendanceTypesReportRow[];
}

@Injectable()
export class GenerateAttendanceTypesPdfUseCase {
  private readonly logger = new Logger(GenerateAttendanceTypesPdfUseCase.name);
  private readonly template: HandlebarsTemplateDelegate<AttendanceTypesTemplateContext> | null = null;

  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly prisma: PrismaService,
    private readonly repo: AttendanceTypeRepository,
  ) {
    // Sentinel-based template resolution (matches generate-asistencia-mensual-pdf.use-case
    // pattern; one extra `../` because this file lives one folder deeper — use-cases/).
    const TEMPLATE_SUBPATH = 'infrastructure/reporting/html-templates';
    const candidateDirs = [
      path.resolve(__dirname, '../../../', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../../src', TEMPLATE_SUBPATH),
      path.resolve(__dirname, '../../../../../src', TEMPLATE_SUBPATH),
    ];
    const sentinel = 'attendance-types.hbs';
    const templateDir = candidateDirs.find((d) => fs.existsSync(path.join(d, sentinel))) ?? candidateDirs[0];
    const templatePath = path.join(templateDir, sentinel);
    if (fs.existsSync(templatePath)) {
      const source = fs.readFileSync(templatePath, 'utf-8');
      this.template = Handlebars.compile<AttendanceTypesTemplateContext>(source);
    }
  }

  async execute(input: GenerateAttendanceTypesPdfInput): Promise<Buffer> {
    const { level, active, currentUser } = input;
    const scope = resolveAccessScope(currentUser);

    const filters: AttendanceTypeFilters = {};
    if (level !== undefined) filters.level = level;
    if (active !== undefined) filters.active = active;

    let types: AttendanceType[];
    if (scope.allLevels) {
      types = await this.repo.list(Object.keys(filters).length ? filters : undefined);
    } else {
      if (level !== undefined && !scope.baseLevels.includes(level)) {
        throw new AttendanceTypeLevelOutOfScopeError(level);
      }
      types = await this.repo.list({ ...filters, allowedLevels: scope.baseLevels });
    }

    return this.render(types);
  }

  // ── Shared render pipeline ───────────────────────────────────────────────

  private async render(types: AttendanceType[]): Promise<Buffer> {
    if (!this.template) {
      throw new Error('Template attendance-types.hbs no encontrado');
    }

    const rows: AttendanceTypesReportRow[] = types
      .slice()
      .sort((a, b) => a.level - b.level || a.code.get().localeCompare(b.code.get()))
      .map((t) => ({
        code: t.code.get(),
        description: t.description,
        levelLabel: EducationalLevel.fromCode(t.level as EducationalLevelCode).label,
        absenceValue: t.absenceValue,
        behavior: t.behavior.get(),
        active: t.active,
      }));

    const { institucionNombre, logoDataUri } = await this.resolveInstitution();

    const context: AttendanceTypesTemplateContext = {
      institucionNombre,
      logoDataUri,
      rows,
    };

    const html = this.template(context);

    this.logger.log(`Generando catálogo de tipos de asistencia PDF (${rows.length} filas)`);
    return this.pdfGenerator.generatePdf(html);
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
}
