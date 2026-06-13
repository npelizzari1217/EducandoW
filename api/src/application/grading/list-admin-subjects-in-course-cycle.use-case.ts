/**
 * ListAdminSubjectsInCourseCycleUseCase
 *
 * Returns ALL subjects of a CourseCycle without teacher filtering.
 * Used by administrative roles (ROOT/ADMIN/DIRECTOR/SECRETARIO).
 *
 * Returns same TeacherSubjectEntry[] shape as ListTeacherSubjectsInCourseCycleUseCase
 * so the front-end response contract is preserved.
 */
import { Injectable } from '@nestjs/common';
import type { MateriaXCursoXCicloRepository } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import type { TeacherSubjectEntry } from './list-teacher-subjects-in-course-cycle.use-case';

@Injectable()
export class ListAdminSubjectsInCourseCycleUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
  ) {}

  async execute(courseCycleId: string): Promise<TeacherSubjectEntry[]> {
    const materias = await this.materiaRepo.findByCourseCycleId(courseCycleId);
    if (materias.length === 0) return [];

    const client = TenantContext.getClient();
    if (!client) return [];

    const subjectIds = materias.map((m) => m.subjectId);

    // Fetch subject names
    const subjects = await client.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s: { id: string; name: string }) => [s.id, s.name]));

    // Resolve studyPlanSubjectId for front-end competency channel
    const studyPlanSubjectMap = new Map<string, string>();
    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { studyPlanId: true, courseId: true },
    });
    if (cc?.studyPlanId) {
      const spc = await client.studyPlanCourse.findFirst({
        where: { studyPlanId: cc.studyPlanId, courseSectionId: cc.courseId },
        select: { id: true },
      });
      if (spc) {
        const spSubjects = await client.studyPlanSubject.findMany({
          where: { studyPlanCourseId: spc.id, subjectId: { in: subjectIds } },
          select: { id: true, subjectId: true },
        });
        for (const sps of spSubjects) {
          studyPlanSubjectMap.set(sps.subjectId, sps.id);
        }
      }
    }

    return subjectIds.map((sid) => ({
      subjectId: sid,
      subjectName: subjectMap.get(sid) ?? sid,
      studyPlanSubjectId: studyPlanSubjectMap.get(sid) ?? null,
    }));
  }
}
