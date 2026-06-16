/**
 * F3-T11 — backfill from SubjectAssignment is idempotent.
 *
 * From a SubjectAssignment (subject ↔ teacher ↔ course-section), the backfill
 * materializes the subject, enrolls students into it, and creates ONE grupo per
 * (materia, docente) covering the full student universe. Running it twice MUST
 * NOT create duplicates or error.
 *
 * Runs the production backfillTenant() directly against the real tenant DB.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { backfillTenant } from '../../../scripts/backfill-materia-grupo';
import { tenantI1Client, resetAll, disconnectAll } from '../setup/clients';
import {
  createAcademicCycle,
  createCourseSection,
  createStudyPlan,
  createStudyPlanCourse,
  createSubject,
  createStudyPlanSubject,
  createCourseCycle,
  createTeacher,
  createSubjectAssignment,
  createDocenteXCiclo,
  createStudent,
  createEnrollment,
} from '../setup/factories';

describe('F3-T11 — backfill grupo creation is idempotent', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('creates one grupo per materia with the full student universe, idempotently', async () => {
    const i1 = tenantI1Client();
    const userId = 'teacher-user-f3t11';

    // Plan with 1 subject, on a course-section at composite level 20 (level 2, modality 0).
    const cycle = await createAcademicCycle(i1);
    const courseSection = await createCourseSection(i1, { level: 20, academicYear: '2026' });
    const studyPlan = await createStudyPlan(i1);
    const planCourse = await createStudyPlanCourse(i1, {
      studyPlanId: studyPlan.id,
      courseSectionId: courseSection.id,
    });
    const subject = await createSubject(i1);
    await createStudyPlanSubject(i1, { studyPlanCourseId: planCourse.id, subjectId: subject.id });
    const courseCycle = await createCourseCycle(i1, {
      cycleId: cycle.uuid,
      courseId: courseSection.id,
      studyPlanId: studyPlan.id,
    });

    // Teacher with a SubjectAssignment + a matching DocenteXCiclo in the cycle.
    const teacher = await createTeacher(i1, { userId });
    await createSubjectAssignment(i1, {
      subjectId: subject.id,
      teacherId: teacher.id,
      courseSectionId: courseSection.id,
    });
    await createDocenteXCiclo(i1, { userId, cycleId: cycle.uuid });

    // One enrolled student (matches the section's level/modality/year).
    const student = await createStudent(i1);
    await createEnrollment(i1, {
      studentId: student.id,
      level: 2,
      modality: 0,
      academicYear: '2026',
    });

    // ── First run ────────────────────────────────────────────────────────
    const r1 = await backfillTenant(i1);
    expect(r1.grupos).toBe(1);

    const materia = await i1.materiaXCursoXCiclo.findFirstOrThrow({
      where: { courseCycleId: courseCycle.uuid },
    });
    const gruposAfter1 = await i1.grupoXCursoXMateriaXCiclo.count({
      where: { materiaXCursoXCicloId: materia.id },
    });
    const alumnosXGrupoAfter1 = await i1.alumnosXGrupoXCursoXMateriaXCiclo.count();
    expect(gruposAfter1).toBe(1); // one grupo per materia
    expect(alumnosXGrupoAfter1).toBe(1); // full student universe

    // ── Second run — idempotent, no duplicates, no error ─────────────────
    const r2 = await backfillTenant(i1);
    expect(r2.grupos).toBe(0); // nothing new created

    const gruposAfter2 = await i1.grupoXCursoXMateriaXCiclo.count({
      where: { materiaXCursoXCicloId: materia.id },
    });
    const alumnosXGrupoAfter2 = await i1.alumnosXGrupoXCursoXMateriaXCiclo.count();
    expect(gruposAfter2).toBe(1); // still exactly one
    expect(alumnosXGrupoAfter2).toBe(1);
  });
});
