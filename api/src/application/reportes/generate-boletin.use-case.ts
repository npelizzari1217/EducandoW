import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';
import type { DatosBoletin, MateriaBoletin } from './templates/boletin.template';

/** Error codes for boletin generation */
export class BoletinError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = 'BoletinError';
  }
}

/**
 * GenerateBoletinUseCase — generates a single student's report card (PDF).
 *
 * Data flow:
 *   enrollment → student → institution → grades + attendance → DatosBoletin → HTML → PDF
 */
@Injectable()
export class GenerateBoletinUseCase {
  private readonly logger = new Logger(GenerateBoletinUseCase.name);
  private readonly templates: Map<string, HandlebarsTemplateDelegate<DatosBoletin>>;

  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly pdfStorage: PdfStorageService,
    private readonly prisma: PrismaService,
  ) {
    // Pre-compile all Handlebars templates at construction time
    this.templates = new Map();

    // Resolve template directory: try dist path first (production), fallback to src (dev)
    const distTemplateDir = path.resolve(__dirname, '../../infrastructure/reporting/html-templates');
    const srcTemplateDir = path.resolve(__dirname, '../../../../src/infrastructure/reporting/html-templates');
    const templateDir = fs.existsSync(distTemplateDir) ? distTemplateDir : srcTemplateDir;
    const templateFiles: Record<string, string> = {
      INICIAL: 'boletin-inicial.hbs',
      PRIMARIO: 'boletin-primario.hbs',
      SECUNDARIO: 'boletin-secundario.hbs',
      TERCIARIO: 'boletin-terciario.hbs',
    };
    for (const [level, file] of Object.entries(templateFiles)) {
      const filePath = path.join(templateDir, file);
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        this.templates.set(level, Handlebars.compile<DatosBoletin>(source));
      }
    }
  }

  /**
   * Generates a PDF boletín for the given enrollment.
   *
   * @returns The PDF Buffer ready to be served as application/pdf.
   */
  async execute(enrollmentId: string): Promise<Buffer> {
    const client = this.tenantClient();

    // 1. Fetch enrollment
    const enrollment = await client.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) {
      throw new BoletinError('Inscripción no encontrada', 'ENROLLMENT_NOT_FOUND', 404);
    }
    if (!enrollment.printable) {
      throw new BoletinError('El alumno está marcado como no imprimible', 'STUDENT_NOT_PRINTABLE', 422);
    }

    // 2. Fetch student
    const student = await client.student.findUnique({ where: { id: enrollment.studentId } });
    if (!student) {
      throw new BoletinError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404);
    }

    // 3. Fetch institution name (master DB)
    const institutionId = TenantContext.getInstitutionId();
    const institution = institutionId
      ? await this.prisma.getMasterClient().institution.findUnique({ where: { id: institutionId } })
      : null;

    // 4. Determine level name
    const levelName = this.resolveLevelName(enrollment.level);

    // 5. Fetch grades and build materias
    const materias = await this.buildMaterias(client, enrollment);

    // 6. Assemble DatosBoletin
    const datos: DatosBoletin = {
      alumnoNombre: student.firstName,
      alumnoApellido: student.lastName,
      alumnoDni: student.dni,
      institucionNombre: institution?.name ?? 'Institución Educativa',
      nivel: levelName,
      grado: enrollment.grade ?? enrollment.division ?? levelName,
      periodo: enrollment.academicYear,
      materias,
    };

    // 7. Choose and render template
    const baseLevel = this.getBaseLevel(enrollment.level);
    const template = this.templates.get(baseLevel);
    if (!template) {
      throw new BoletinError(
        `Nivel pedagógico no soportado para boletín: ${levelName}`,
        'BOLETIN_LEVEL_UNKNOWN',
        422,
      );
    }
    const html = template(datos);

    // 8. Generate PDF
    const pdfBuffer = await this.pdfGenerator.generatePdf(html);

    // 9. Store PDF for future requests
    await this.pdfStorage.save(enrollmentId, pdfBuffer);

    this.logger.log(`Boletín PDF generated for enrollment ${enrollmentId} (${student.lastName}, ${student.firstName})`);

    return pdfBuffer;
  }

  // ── Data aggregation ───────────────────────────────────────

  /**
   * Aggregates subject grades for the enrollment's level.
   * Queries NotaTrimestral records tied to the student and mapped to subjects
   * through the enrollment's cycle/course assignments.
   */
  private async buildMaterias(
    client: TenantPrismaClient,
    enrollment: { id: string; studentId: string; level: number; cycleId: string | null; academicYear: string },
  ): Promise<MateriaBoletin[]> {
    // Get the course section(s) for this enrollment via the cycle
    if (!enrollment.cycleId) {
      // No cycle => no grades yet
      return [];
    }

    // Find course cycles for this academic cycle
    const courseCycles = await client.courseCycle.findMany({
      where: { cycleId: enrollment.cycleId, active: true },
      include: { course: true },
    });

    if (courseCycles.length === 0) {
      return [];
    }

    // Get subject assignments for the course sections
    const courseSectionIds = courseCycles.map(cc => cc.courseId);
    const assignments = await client.subjectAssignment.findMany({
      where: { courseSectionId: { in: courseSectionIds }, active: true },
      include: { subject: true, teacher: true },
    });

    if (assignments.length === 0) {
      return [];
    }

    // Get the period IDs (trimesters/cuatrimesters) for this academic year
    const periodos = await client.periodoEvaluacion.findMany({
      where: { academicYear: enrollment.academicYear, active: true },
      orderBy: { startDate: 'asc' },
    });

    // Get NotaTrimestral records for this student across all assignments
    const assignmentIds = assignments.map(a => a.id);
    const notasTrimestrales = await client.notaTrimestral.findMany({
      where: {
        studentId: enrollment.studentId,
        assignmentId: { in: assignmentIds },
        active: true,
      },
    });

    // Build MateriaBoletin for each subject
    const materias: MateriaBoletin[] = [];

    for (const assignment of assignments) {
      const notas = periodos.map(p => {
        const nt = notasTrimestrales.find(
          n => n.assignmentId === assignment.id && n.periodId === p.id,
        );
        return {
          periodo: p.name,
          valor: nt ? String(nt.finalGrade) : '—',
        };
      });

      // Calculate average from available grades
      const numericValues = notasTrimestrales
        .filter(n => n.assignmentId === assignment.id)
        .map(n => n.finalGrade);
      const promedio = numericValues.length > 0
        ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2)
        : '—';

      const aprobado = numericValues.length > 0
        && (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) >= 6;

      materias.push({
        nombre: assignment.subject.name,
        docente: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}`,
        notas,
        promedio,
        valoracion: aprobado ? 'Aprobado' : 'Desaprobado',
        aprobado,
      });
    }

    return materias;
  }

  // ── Helpers ────────────────────────────────────────────────

  private tenantClient(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500);
    return c;
  }

  /** Maps LevelType enum to human-readable base level name. */
  private resolveLevelName(levelCode: number): string {
    const base = Math.floor(levelCode / 10) * 10;
    const names: Record<number, string> = {
      10: 'INICIAL',
      20: 'PRIMARIO',
      30: 'SECUNDARIO',
      40: 'TERCIARIO',
    };
    return names[base] ?? `NIVEL_${levelCode}`;
  }

  /** Returns the base level string (INICIAL/PRIMARIO/SECUNDARIO/TERCIARIO) for template selection. */
  private getBaseLevel(levelCode: number): string {
    const base = Math.floor(levelCode / 10) * 10;
    const names: Record<number, string> = {
      10: 'INICIAL',
      20: 'PRIMARIO',
      30: 'SECUNDARIO',
      40: 'TERCIARIO',
    };
    return names[base] ?? 'PRIMARIO';
  }
}
