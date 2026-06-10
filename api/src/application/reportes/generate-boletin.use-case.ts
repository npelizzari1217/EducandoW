import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';
import type { DatosBoletin, MateriaBoletin, AsistenciaBoletin, MesaExamenBoletin } from './templates/boletin.template';
import type {
  SubjectGradingPeriodRepository,
  SubjectPeriodGradeRepository,
  SubjectFinalGradeRepository,
  CompetencyValuationRepository,
} from '@educandow/domain';

// ── Primario constants ─────────────────────────────────────────────────────────
const ALL_FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

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
    private readonly sgpRepo?: SubjectGradingPeriodRepository,
    private readonly periodGradeRepo?: SubjectPeriodGradeRepository,
    private readonly finalGradeRepo?: SubjectFinalGradeRepository,
    private readonly cvRepo?: CompetencyValuationRepository,
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
   * Cache-first: returns stored PDF if available; regenerates otherwise.
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

    // 2. Cache-first: return stored PDF if it already exists
    const cachedPath = await this.pdfStorage.getPath(enrollmentId);
    if (cachedPath) {
      this.logger.log(`Returning cached PDF for enrollment ${enrollmentId}`);
      return fs.promises.readFile(cachedPath);
    }

    // 3. Fetch student
    const student = await client.student.findUnique({ where: { id: enrollment.studentId } });
    if (!student) {
      throw new BoletinError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404);
    }

    // 4. Fetch institution name (master DB)
    const institutionId = TenantContext.getInstitutionId();
    const institution = institutionId
      ? await this.prisma.getMasterClient().institution.findUnique({ where: { id: institutionId } })
      : null;

    // 5. Determine level name
    const levelName = this.resolveLevelName(enrollment.level);

    // 6. Fetch grades and build materias
    const materias = await this.buildMaterias(client, enrollment);

    // 7. Build attendance summary
    const asistencia = await this.buildAsistencia(client, enrollment.studentId, enrollment.cycleId ?? null);

    // 7b. Build exam board results (SECUNDARIO only)
    const baseLevel = this.getBaseLevel(enrollment.level);
    const mesasExamen = baseLevel === 'SECUNDARIO'
      ? await this.buildMesasExamen(client, enrollment.studentId)
      : undefined;

    // 8. Assemble DatosBoletin
    const datos: DatosBoletin = {
      alumnoNombre: student.firstName,
      alumnoApellido: student.lastName,
      alumnoDni: student.dni,
      institucionNombre: institution?.name ?? 'Institución Educativa',
      nivel: levelName,
      grado: enrollment.grade ?? enrollment.division ?? levelName,
      periodo: enrollment.academicYear,
      materias,
      asistencia,
      mesasExamen,
    };

    // 9. Choose and render template
    const template = this.templates.get(baseLevel);
    if (!template) {
      throw new BoletinError(
        `Nivel pedagógico no soportado para boletín: ${levelName}`,
        'BOLETIN_LEVEL_UNKNOWN',
        422,
      );
    }
    const html = template(datos);

    // 10. Generate PDF
    const pdfBuffer = await this.pdfGenerator.generatePdf(html);

    // 11. Store PDF for future requests
    await this.pdfStorage.save(enrollmentId, pdfBuffer);

    this.logger.log(`Boletín PDF generated for enrollment ${enrollmentId} (${student.lastName}, ${student.firstName})`);

    return pdfBuffer;
  }

  // ── Data aggregation ───────────────────────────────────────

  /**
   * Aggregates subject grades for the enrollment's level.
   *
   * Level dispatch (PR7):
   *   Math.floor(level/10) === 2 → Primario branch (buildMateriasPrimario)
   *   Otherwise → legacy NotaTrimestral path (unchanged)
   */
  private async buildMaterias(
    client: TenantPrismaClient,
    enrollment: { id: string; studentId: string; level: number; cycleId: string | null; academicYear: string },
  ): Promise<MateriaBoletin[]> {
    // ── PR7: Level dispatch — Primario path ────────────────────────────────────
    if (
      Math.floor(enrollment.level / 10) === 2
      && this.sgpRepo
      && this.periodGradeRepo
      && this.finalGradeRepo
      && this.cvRepo
    ) {
      return this.buildMateriasPrimario(client, enrollment);
    }

    // ── Legacy NotaTrimestral path (Secundario, Terciario, Inicial) ───────────
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

  // ── PR7: Primario branch ───────────────────────────────────────────────────

  /**
   * Builds MateriaBoletin[] for a Primario enrollment using:
   *   - SubjectGradingPeriod   → dynamic period column names
   *   - SubjectPeriodGrade     → period grades + pa/ppi/pp flags
   *   - SubjectFinalGrade      → 4 final instances (absent → blank, not error)
   *   - CompetencyValuation    → competencies filtered to imprimible=true
   *
   * All four sources are bulk-fetched per CourseCycle to avoid N+1.
   * imprimible filter is applied HERE (use case), NOT in the template.
   */
  async buildMateriasPrimario(
    client: TenantPrismaClient,
    enrollment: { studentId: string; level: number; cycleId: string | null; academicYear: string },
  ): Promise<MateriaBoletin[]> {
    if (!enrollment.cycleId) return [];

    // 1. Fetch all courseCycles for this academic cycle
    const courseCycles = await client.courseCycle.findMany({
      where: { cycleId: enrollment.cycleId, active: true },
      select: { uuid: true, level: true, courseId: true, studyPlanId: true },
    });

    // Filter to Primario CCs (Math.floor(level/10) === 2)
    const primarioCCs = courseCycles.filter(
      (cc) => Math.floor((cc.level as number) / 10) === 2,
    );
    if (primarioCCs.length === 0) return [];

    const materias: MateriaBoletin[] = [];

    for (const cc of primarioCCs) {
      // 2. Resolve subjects via StudyPlan → gets studyPlanSubjectId for competencies
      const subjectEntries = await this.resolveSubjectsForCC(client, cc);
      if (subjectEntries.length === 0) continue;

      // 3. Teacher lookup (bulk, no N+1)
      const assignments = await client.subjectAssignment.findMany({
        where: { courseSectionId: cc.courseId, active: true },
        select: {
          subjectId: true,
          teacher: { select: { firstName: true, lastName: true } },
        },
      });
      const teacherBySubjectId = new Map(
        assignments.map((a) => [
          a.subjectId,
          a.teacher as { firstName: string; lastName: string },
        ]),
      );

      // 4. Bulk fetch period grades for student × CC (avoids N+1)
      const allPeriodGrades = await this.periodGradeRepo!.findByStudentAndCourseCycle(
        enrollment.studentId,
        cc.uuid,
      );

      // 5. Bulk fetch final grades for student × CC
      const allFinalGrades = await this.finalGradeRepo!.findByStudentAndCourseCycle(
        enrollment.studentId,
        cc.uuid,
      );

      // Index period grades by subjectId for O(1) lookup
      const pgBySubject = new Map<string, typeof allPeriodGrades>();
      for (const g of allPeriodGrades) {
        const bucket = pgBySubject.get(g.subjectId) ?? [];
        bucket.push(g);
        pgBySubject.set(g.subjectId, bucket);
      }

      // Index final grades by (subjectId → (type → grade))
      const fgBySubject = new Map<string, Map<string, (typeof allFinalGrades)[0]>>();
      for (const f of allFinalGrades) {
        if (!fgBySubject.has(f.subjectId)) {
          fgBySubject.set(f.subjectId, new Map());
        }
        fgBySubject.get(f.subjectId)!.set(f.type, f);
      }

      // 6. Per-subject: assemble MateriaBoletin with Primario fields
      for (const { subjectId, subjectName, studyPlanSubjectId } of subjectEntries) {
        // 6a. Period structure from snapshot (column names)
        const periods = await this.sgpRepo!.findByCourseCycleAndSubject(cc.uuid, subjectId);
        const subjectPeriodGrades = pgBySubject.get(subjectId) ?? [];
        const pgByOrdinal = new Map(
          subjectPeriodGrades.map((g) => [g.periodOrdinal, g]),
        );

        // 6b. Final grades — 4 instances, absent → blank
        const subjectFinalMap = fgBySubject.get(subjectId) ?? new Map();

        // 6c. Competencies filtered to imprimible=true (boletín only — use case layer)
        const competencies: Array<{ competencyName: string; gradeCode: string }> = [];
        if (studyPlanSubjectId) {
          const allCvs = await this.cvRepo!.findByCourseCycleAndStudyPlanSubject(
            cc.uuid,
            studyPlanSubjectId,
          );
          for (const cv of allCvs) {
            if (cv.studentId !== enrollment.studentId) continue;
            // Include competency only if at least one period is imprimible=true
            const firstImprimible = cv.periodValuations.find((pv) => pv.imprimible);
            if (firstImprimible) {
              competencies.push({
                competencyName: cv.competencyName,
                gradeCode: firstImprimible.gradeCode ?? '',
              });
            }
          }
        }

        // 6d. OR-aggregate pa/ppi/pp across all reported periods for this subject
        const pa  = subjectPeriodGrades.some((g) => g.pa);
        const ppi = subjectPeriodGrades.some((g) => g.ppi);
        const pp  = subjectPeriodGrades.some((g) => g.pp);

        // 6e. Teacher name (legacy required field)
        const teacher = teacherBySubjectId.get(subjectId);
        const docente = teacher ? `${teacher.lastName}, ${teacher.firstName}` : '';

        materias.push({
          nombre:    subjectName,
          docente,
          // Legacy fields — not used by the rebuilt Primario template, but required by type
          notas:     [],
          promedio:  '',
          valoracion: '',
          aprobado:  false,
          // Primario-specific optional fields
          periodGrades: periods.map((p) => ({
            periodOrdinal: p.periodOrdinal,
            periodName:    p.periodName,
            gradeCode:     pgByOrdinal.get(p.periodOrdinal)?.gradeCode ?? '',
          })),
          finalGrades: ALL_FINAL_TYPES.map((type) => {
            const f = subjectFinalMap.get(type);
            return { type, gradeCode: f?.gradeCode ?? '' };
          }),
          competencies,
          flags: { pa, ppi, pp },
        });
      }
    }

    return materias;
  }

  /**
   * Resolves subjects for a CourseCycle via StudyPlan → StudyPlanCourse → StudyPlanSubject.
   * Returns the subjectId, subjectName, and studyPlanSubjectId for each subject.
   * studyPlanSubjectId is used to query competency valuations (imprimible filter).
   */
  private async resolveSubjectsForCC(
    client: TenantPrismaClient,
    cc: { uuid: string; courseId: string; studyPlanId: string },
  ): Promise<Array<{ subjectId: string; subjectName: string; studyPlanSubjectId: string | null }>> {
    const spc = await client.studyPlanCourse.findFirst({
      where: { studyPlanId: cc.studyPlanId, courseSectionId: cc.courseId },
      select: { id: true },
    });
    if (!spc) return [];

    const spSubjects = await client.studyPlanSubject.findMany({
      where: { studyPlanCourseId: spc.id },
      select: {
        id: true,
        subjectId: true,
        subject: { select: { id: true, name: true } },
      },
    });

    return spSubjects.map((sps) => ({
      subjectId:          sps.subjectId,
      subjectName:        (sps.subject as { name: string }).name,
      studyPlanSubjectId: sps.id,
    }));
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

  /**
   * Returns the base level string for template selection.
   * Throws BOLETIN_LEVEL_UNKNOWN (422) for unrecognised level codes
   * instead of silently defaulting to PRIMARIO (which would produce a wrong PDF).
   */
  getBaseLevel(levelCode: number): string {
    const base = Math.floor(levelCode / 10) * 10;
    const names: Record<number, string> = {
      10: 'INICIAL',
      20: 'PRIMARIO',
      30: 'SECUNDARIO',
      40: 'TERCIARIO',
    };
    const name = names[base];
    if (!name) {
      throw new BoletinError(
        `Nivel pedagógico desconocido: ${levelCode}`,
        'BOLETIN_LEVEL_UNKNOWN',
        422,
      );
    }
    return name;
  }

  /**
   * Builds the list of exam board (mesa de examen) results for a given student.
   * Only called for SECUNDARIO level. Returns an empty array when none exist.
   */
  async buildMesasExamen(
    client: TenantPrismaClient,
    studentId: string,
  ): Promise<MesaExamenBoletin[]> {
    const inscripciones = await client.mesaExamenInscripcion.findMany({
      where: { studentId, mesa: { active: true } },
      include: { mesa: { include: { subject: true } } },
      orderBy: { mesa: { fecha: 'asc' } },
    });

    return inscripciones.map((i) => {
      const fecha = i.mesa.fecha;
      const dd = String(fecha.getDate()).padStart(2, '0');
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      const aaaa = fecha.getFullYear();
      return {
        materia: i.mesa.subject.name,
        turno: i.mesa.turno,
        fecha: `${dd}/${mm}/${aaaa}`,
        nota: i.notaFinal !== null ? String(i.notaFinal) : '—',
        condicion: i.condicionFinal,
        aprobada: i.condicionFinal === 'APROBADO',
      };
    });
  }

  /**
   * Builds an attendance summary for the given student within the given cycle.
   * Returns undefined when no attendance records exist (no cycleId or no records).
   */
  async buildAsistencia(
    client: TenantPrismaClient,
    studentId: string,
    cycleId: string | null,
  ): Promise<AsistenciaBoletin | undefined> {
    if (!cycleId) return undefined;

    const records = await client.attendance.findMany({
      where: { studentId, cycleId, active: true },
    });

    if (records.length === 0) return undefined;

    const totalDias = records.length;
    const diasPresente = records.filter(r => r.isPresent === true).length;
    const inasistencias = records.filter(r => r.absenceValue === 1).length;
    const mediasFaltas = records.filter(r => r.absenceValue === 0.5).length;
    const porcentaje = totalDias > 0
      ? ((diasPresente / totalDias) * 100).toFixed(1)
      : '0.0';

    return { totalDias, diasPresente, inasistencias, mediasFaltas, porcentaje };
  }
}
