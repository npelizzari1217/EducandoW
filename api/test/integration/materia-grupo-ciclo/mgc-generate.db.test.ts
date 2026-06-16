/**
 * MGC-S1 (F3-T9) / MGC-S2 (F3-T10) — subject generation from a study plan.
 *
 * MGC-S1: generating from a plan with N subjects creates N MateriaXCursoXCiclo,
 *         one per plan subject, linked to the CourseCycle.
 * MGC-S2: creating the CicloLectivo alone creates zero MateriaXCursoXCiclo.
 *
 * MaterializeMateriasUseCase is the production unit that creates the rows
 * (GenerateCourseCyclesUseCase delegates to it fire-and-forget). We drive it
 * directly so the row-creation contract is asserted deterministically, with
 * plan data seeded as a real StudyPlan → StudyPlanCourse → StudyPlanSubject chain.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MaterializeMateriasUseCase } from '../../../src/application/materia-grupo-ciclo/materialize-materias.use-case';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import {
  seedCourseCycle,
  createAcademicCycle,
  createSubject,
  createStudyPlanCourse,
  createStudyPlanSubject,
} from '../setup/factories';

const materiaRepo = new PrismaMateriaXCursoXCicloRepository();
const materializeUC = new MaterializeMateriasUseCase(new PrismaMateriaXCursoXCicloRepository());

describe('MGC-S1/MGC-S2 — subject generation', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('MGC-S1: generating from a plan of N subjects creates N MateriaXCursoXCiclo', async () => {
    const N = 8;
    const i1 = tenantI1Client();
    const { courseSection, studyPlan, courseCycle } = await seedCourseCycle(i1);
    const planCourse = await createStudyPlanCourse(i1, {
      studyPlanId: studyPlan.id,
      courseSectionId: courseSection.id,
    });

    // Seed a plan with N subjects.
    const planSubjects: { subjectId: string; studyPlanSubjectId: string }[] = [];
    for (let k = 0; k < N; k++) {
      const subject = await createSubject(i1);
      const sps = await createStudyPlanSubject(i1, {
        studyPlanCourseId: planCourse.id,
        subjectId: subject.id,
      });
      planSubjects.push({ subjectId: subject.id, studyPlanSubjectId: sps.id });
    }

    await runInTenant(i1, () =>
      materializeUC.execute({ courseCycleId: courseCycle.uuid, planSubjects }),
    );

    const materias = await runInTenant(i1, () =>
      materiaRepo.findByCourseCycleId(courseCycle.uuid),
    );
    expect(materias).toHaveLength(N);
    expect(new Set(materias.map((m) => m.subjectId))).toEqual(
      new Set(planSubjects.map((p) => p.subjectId)),
    );
  });

  it('MGC-S2: creating the CicloLectivo alone creates zero MateriaXCursoXCiclo', async () => {
    const i1 = tenantI1Client();
    await createAcademicCycle(i1, { code: '2026', name: '2026' });

    // No generation/materialization ran → no subjects materialized anywhere.
    const count = await i1.materiaXCursoXCiclo.count();
    expect(count).toBe(0);
  });
});
