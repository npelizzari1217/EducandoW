import { Injectable } from '@nestjs/common';
import { NotFoundError, CompetenciaXMateriaXAlumnoXCursoXCiclo } from '@educandow/domain';
import type {
  AlumnosXCursoXCicloRepository,
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  SubjectCompetencyRepository,
  CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
} from '@educandow/domain';

export interface CascadeResult {
  materiasCreated: number;
  materiasSkipped: number;
  competenciasCreated: number;
  competenciasSkipped: number;
}

/**
 * CascadeStudentMateriasCompetenciasUseCase — SDD-3 PR-3.
 *
 * Materializes ALL of the CourseCycle's study-plan materias AND their active
 * competencies for a SINGLE student, identified by the AlumnosXCursoXCiclo
 * bridge-row id.
 *
 * Additive / skipDuplicates semantics: existing rows are left completely
 * unchanged (ADR-6, ADR-7). Grade children (CompetenciaXPeriodoXMateria…) are
 * never touched — grade preservation is structural (ADR-7).
 *
 * Mirrors:
 *   - MaterializeMateriasUseCase for the per-student materia upsert pattern
 *   - AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC for the competency chain
 */
@Injectable()
export class CascadeStudentMateriasCompetenciasUseCase {
  constructor(
    private readonly alumnosCCRepo: AlumnosXCursoXCicloRepository,
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosXMateriaRepo: AlumnosXMateriaRepository,
    private readonly competencyRepo: SubjectCompetencyRepository,
    private readonly competenciaRepo: CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
  ) {}

  async execute(input: { id: string; ccId: string }): Promise<CascadeResult> {
    // 1. Resolve bridge row; IDOR: must belong to :ccId
    const row = await this.alumnosCCRepo.findById(input.id);
    if (!row || row.courseCycleId !== input.ccId) {
      throw new NotFoundError('AlumnosXCursoXCiclo', input.id);
    }

    const { studentId } = row;
    const { ccId } = input;

    // 2. Resolve all materialized MateriaXCursoXCiclo rows for this CourseCycle,
    //    excluding optativas — non-enrolled students must not receive optativa
    //    competency rows (MGC-R8, D2).
    const materias = (await this.materiaRepo.findByCourseCycleId(ccId)).filter((m) => !m.esOptativa);

    // Edge case: no materias → all counts zero, no error (R-13)
    if (materias.length === 0) {
      return { materiasCreated: 0, materiasSkipped: 0, competenciasCreated: 0, competenciasSkipped: 0 };
    }

    // 3. Upsert one MateriasXAlumnoXCursoXCiclo row per materia for this student
    const { count: materiasCreated } = await this.alumnosXMateriaRepo.upsertMany(
      materias.map((m) => ({ materiaXCursoXCicloId: m.id, studentId })),
    );
    const materiasSkipped = materias.length - materiasCreated;

    // 4. Resolve active competencies using each materia's studyPlanSubjectId
    //    (same resolution chain as AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC
    //     but scoped to the materias already present in this CC)
    const uniqueSpsIds = [
      ...new Set(
        materias
          .map((m) => m.studyPlanSubjectId)
          .filter((id): id is string => id !== undefined),
      ),
    ];

    if (uniqueSpsIds.length === 0) {
      // No study-plan provenance → no competencies to create
      return { materiasCreated, materiasSkipped, competenciasCreated: 0, competenciasSkipped: 0 };
    }

    const competencyLists = await Promise.all(
      uniqueSpsIds.map((spsId) => this.competencyRepo.findActiveByStudyPlanSubject(spsId)),
    );
    const allCompetencies = competencyLists.flat();

    if (allCompetencies.length === 0) {
      return { materiasCreated, materiasSkipped, competenciasCreated: 0, competenciasSkipped: 0 };
    }

    // 5. Build parent valuation rows for (competencyId, studentId, courseCycleId)
    const valuations = allCompetencies.map((c) =>
      CompetenciaXMateriaXAlumnoXCursoXCiclo.create({
        competencyId: c.id.get(),
        studentId,
        courseCycleId: ccId,
      }),
    );

    // 6. Batch-create with skipDuplicates — never touches grade children (ADR-7)
    const { count: competenciasCreated } = await this.competenciaRepo.bulkCreate(valuations);
    const competenciasSkipped = valuations.length - competenciasCreated;

    return { materiasCreated, materiasSkipped, competenciasCreated, competenciasSkipped };
  }
}
