/**
 * CV-S21 / CV-S22 — competency_valuations unique-constraint scope.
 *
 * Validates the 3-col unique (studentId, competencyId, courseCycleId) that replaced
 * the legacy 2-col (studentId, competencyId) unique in the drift-baseline migration.
 *
 * CV-S21: same student + same competency in TWO different CourseCycles → 2 rows, no error.
 *         Proves the old 2-col unique is gone from the test DB.
 * CV-S22: same (student, competency, courseCycle) triple inserted twice → P2002.
 *         Proves the 3-col unique is enforced.
 *
 * Run via: pnpm --filter api test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  tenantI1Client,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import {
  createStudent,
  createSubject,
  createStudyPlanCourse,
  createStudyPlanSubject,
  seedCourseCycle,
} from '../setup/factories';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

/**
 * Seeds a SubjectCompetency using the StudyPlan + CourseSection from a seedCourseCycle call.
 * StudyPlanSubject is the required parent; Subject is created inline.
 */
async function seedCompetency(
  tenant: TenantPrismaClient,
  studyPlanId: string,
  courseSectionId: string,
) {
  const subject = await createSubject(tenant);
  const studyPlanCourse = await createStudyPlanCourse(tenant, {
    studyPlanId,
    courseSectionId,
  });
  const studyPlanSubject = await createStudyPlanSubject(tenant, {
    studyPlanCourseId: studyPlanCourse.id,
    subjectId: subject.id,
  });
  return tenant.subjectCompetency.create({
    data: { studyPlanSubjectId: studyPlanSubject.id, name: 'Competencia Test' },
  });
}

describe('competency_valuations — unique-constraint scope (CV-S21 / CV-S22)', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('CV-S21: same student + same competency in two different CourseCycles → both rows persist (2-col unique is gone)', async () => {
    const i1 = tenantI1Client();

    const { courseSection, studyPlan, courseCycle: cc1 } = await seedCourseCycle(i1);
    const { courseCycle: cc2 } = await seedCourseCycle(i1);
    const student = await createStudent(i1);
    const competency = await seedCompetency(i1, studyPlan.id, courseSection.id);

    // First valuation: student × competency × cc1
    await i1.competenciaXMateriaXAlumnoXCursoXCiclo.create({
      data: {
        studentId: student.id,
        competencyId: competency.id,
        courseCycleId: cc1.uuid,
      },
    });

    // Second valuation: same student × same competency × DIFFERENT cc2 — must NOT throw
    await expect(
      i1.competenciaXMateriaXAlumnoXCursoXCiclo.create({
        data: {
          studentId: student.id,
          competencyId: competency.id,
          courseCycleId: cc2.uuid,
        },
      }),
    ).resolves.toBeDefined();

    const count = await i1.competenciaXMateriaXAlumnoXCursoXCiclo.count({
      where: { studentId: student.id, competencyId: competency.id },
    });
    expect(count).toBe(2);
  });

  it('CV-S22: same (student, competency, courseCycle) triple inserted twice → P2002 unique violation', async () => {
    const i1 = tenantI1Client();

    const { courseSection, studyPlan, courseCycle } = await seedCourseCycle(i1);
    const student = await createStudent(i1);
    const competency = await seedCompetency(i1, studyPlan.id, courseSection.id);

    // First insert — must succeed
    await i1.competenciaXMateriaXAlumnoXCursoXCiclo.create({
      data: {
        studentId: student.id,
        competencyId: competency.id,
        courseCycleId: courseCycle.uuid,
      },
    });

    // Second identical insert — must fail with P2002 (3-col unique violated)
    await expect(
      i1.competenciaXMateriaXAlumnoXCursoXCiclo.create({
        data: {
          studentId: student.id,
          competencyId: competency.id,
          courseCycleId: courseCycle.uuid,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
