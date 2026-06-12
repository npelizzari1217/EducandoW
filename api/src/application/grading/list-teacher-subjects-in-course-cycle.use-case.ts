/**
 * ListTeacherSubjectsInCourseCycleUseCase — modelo NUEVO (DocenteXCiclo + grupos).
 *
 * Reemplaza Teacher+SubjectAssignment por DocenteXCiclo+GrupoRepository.
 * Path: userId+cycleId → DocenteXCiclo → GrupoXCursoXMateriaXCiclo (filtrando por CC)
 *       → MateriaXCursoXCiclo.subjectId → nombres + studyPlanSubjectId.
 *
 * userId sin DocenteXCiclo en este ciclo → empty array, never error.
 * CC not found → empty array (cross-tenant isolation).
 * Specs: TIA-R4, TIA-R7
 */
import { Injectable } from '@nestjs/common';
import type { DocenteXCicloRepository, GrupoRepository } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface TeacherSubjectEntry {
  subjectId: string;
  subjectName: string;
  /**
   * StudyPlanSubject.id for this (courseCycle, subject) pair.
   * Needed by the front-end to feed the competency channel (PR5b).
   * Null when the subject has no study-plan mapping (data inconsistency).
   */
  studyPlanSubjectId: string | null;
}

@Injectable()
export class ListTeacherSubjectsInCourseCycleUseCase {
  constructor(
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly grupoRepo: GrupoRepository,
  ) {}

  async execute(input: { userId: string; courseCycleId: string }): Promise<TeacherSubjectEntry[]> {
    // 1. Get CourseCycle to extract cycleId (needed for DocenteXCiclo lookup)
    const client = TenantContext.getClient();
    if (!client) return [];

    const cc = await client.courseCycle.findUnique({
      where: { uuid: input.courseCycleId },
      select: { cycleId: true, courseId: true, studyPlanId: true },
    });
    if (!cc) return []; // cross-tenant or not-found

    // 2. Find DocenteXCiclo for (userId, cycleId)
    const dxc = await this.docenteRepo.findByUserAndCycle(input.userId, cc.cycleId);
    if (!dxc) return [];

    // 3. Get all grupos for this DocenteXCiclo (may span multiple CCs)
    const grupos = await this.grupoRepo.findByDocente(dxc.id);
    if (grupos.length === 0) return [];

    // 4. Filter materias belonging to THIS CC only
    const materiaIds = grupos.map((g) => g.materiaXCursoXCicloId);
    const materias = await client.materiaXCursoXCiclo.findMany({
      where: { id: { in: materiaIds }, courseCycleId: input.courseCycleId },
      select: { id: true, subjectId: true },
    });
    if (materias.length === 0) return [];

    // 5. Fetch subject names from the tenant DB
    const subjectIds = materias.map((m) => m.subjectId);
    const subjects = await client.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    // 6. Bulk-resolve studyPlanSubjectId for each subject (needed by front-end competency channel).
    //    Path: studyPlanId + courseId → StudyPlanCourse → StudyPlanSubject.
    const studyPlanSubjectMap = new Map<string, string>();
    if (cc.studyPlanId) {
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
