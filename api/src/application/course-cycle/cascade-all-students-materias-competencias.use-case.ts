import { Injectable, Logger } from '@nestjs/common';
import { CompetenciaXMateriaXAlumnoXCursoXCiclo } from '@educandow/domain';
import type {
  AlumnosXCursoXCicloRepository,
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  SubjectCompetencyRepository,
  CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
} from '@educandow/domain';

/**
 * BulkCascadeResult — aggregated outcome across all students.
 * Mirrors CascadeResult shape (per-student UC) plus student-level counters.
 * Plain object — no Result<T,E> (ADR-B3).
 */
export interface BulkCascadeResult {
  studentsProcessed: number;
  studentsFailed: number;
  materiasCreated: number;
  materiasSkipped: number;
  competenciasCreated: number;
  competenciasSkipped: number;
}

/**
 * CascadeAllStudentsMateriasCompetenciasUseCase — SDD asignacion-cascade-masiva T-01.
 *
 * Materializes ALL of the CourseCycle's study-plan materias AND their active
 * competencies for EVERY enrolled student in a single batch, identified by ccId.
 *
 * Optimizations over looping the per-student UC:
 *   - findByCourseCycleId called ONCE (not per student) — no N+1
 *   - findActiveByStudyPlanSubject called ONCE per unique SPS ID (not per student)
 *
 * Best-effort semantics (ADR-B2): one student failure increments studentsFailed
 * and the loop continues — no batch-level throw.
 *
 * Additive / idempotent via skipDuplicates in upsertMany and bulkCreate (ADR-6).
 * Grade children (CompetenciaXPeriodoXMateria…) are never touched (ADR-7).
 */
@Injectable()
export class CascadeAllStudentsMateriasCompetenciasUseCase {
  private readonly logger = new Logger(CascadeAllStudentsMateriasCompetenciasUseCase.name);

  constructor(
    private readonly alumnosCCRepo: AlumnosXCursoXCicloRepository,
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosXMateriaRepo: AlumnosXMateriaRepository,
    private readonly competencyRepo: SubjectCompetencyRepository,
    private readonly competenciaRepo: CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
  ) {}

  async execute(input: { ccId: string }): Promise<BulkCascadeResult> {
    const { ccId } = input;

    // 1. Get all enrolled students for this CourseCycle.
    //    No IDOR check needed — we are operating at the CC level, not per bridge-row id.
    const rows = await this.alumnosCCRepo.findByCourseCycle(ccId);

    // Edge case: no students enrolled → all zeros, no error (ADR-B4 / SC-05)
    if (rows.length === 0) {
      return {
        studentsProcessed: 0,
        studentsFailed: 0,
        materiasCreated: 0,
        materiasSkipped: 0,
        competenciasCreated: 0,
        competenciasSkipped: 0,
      };
    }

    // 2. Fetch materias ONCE for this CourseCycle, excluding optativas.
    const materias = (await this.materiaRepo.findByCourseCycleId(ccId)).filter((m) => !m.esOptativa);

    // Edge case: no non-optativa materias → return rows.length for studentsProcessed, rest zero
    if (materias.length === 0) {
      return {
        studentsProcessed: rows.length,
        studentsFailed: 0,
        materiasCreated: 0,
        materiasSkipped: 0,
        competenciasCreated: 0,
        competenciasSkipped: 0,
      };
    }

    // 3. Resolve active competencies ONCE per unique studyPlanSubjectId.
    //    Same chain as CascadeStudentMateriasCompetenciasUseCase but hoisted above the student loop.
    const uniqueSpsIds = [
      ...new Set(
        materias
          .map((m) => m.studyPlanSubjectId)
          .filter((id): id is string => id !== undefined),
      ),
    ];

    let allCompetencies: Awaited<ReturnType<SubjectCompetencyRepository['findActiveByStudyPlanSubject']>> = [];
    if (uniqueSpsIds.length > 0) {
      const competencyLists = await Promise.all(
        uniqueSpsIds.map((spsId) => this.competencyRepo.findActiveByStudyPlanSubject(spsId)),
      );
      allCompetencies = competencyLists.flat();
    }

    // 4. Loop students with best-effort per-student try/catch (ADR-B2).
    let studentsProcessed = 0;
    let studentsFailed = 0;
    let materiasCreated = 0;
    let materiasSkipped = 0;
    let competenciasCreated = 0;
    let competenciasSkipped = 0;

    for (const row of rows) {
      try {
        const { studentId } = row;

        // 4a. Upsert MateriasXAlumnoXCursoXCiclo rows for this student
        const { count: mc } = await this.alumnosXMateriaRepo.upsertMany(
          materias.map((m) => ({ materiaXCursoXCicloId: m.id, studentId })),
        );
        materiasCreated += mc;
        materiasSkipped += materias.length - mc;

        // 4b. Build and batch-create parent competency valuation rows
        if (allCompetencies.length > 0) {
          const valuations = allCompetencies.map((c) =>
            CompetenciaXMateriaXAlumnoXCursoXCiclo.create({
              competencyId: c.id.get(),
              studentId,
              courseCycleId: ccId,
            }),
          );
          const { count: cc } = await this.competenciaRepo.bulkCreate(valuations);
          competenciasCreated += cc;
          competenciasSkipped += valuations.length - cc;
        }

        studentsProcessed++;
      } catch (err) {
        studentsFailed++;
        this.logger?.warn(
          `[CascadeAll] Student ${row.studentId} failed in CC ${ccId}: ${String(err)}`,
        );
      }
    }

    return {
      studentsProcessed,
      studentsFailed,
      materiasCreated,
      materiasSkipped,
      competenciasCreated,
      competenciasSkipped,
    };
  }
}
