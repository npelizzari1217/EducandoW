/**
 * PR4-T14 [GREEN] — ListTeacherSubjectsInCourseCycleUseCase.
 *
 * Returns only the subjects in the given CourseCycle to which the resolved teacher
 * has a SubjectAssignment. (TIA-R4)
 *
 * Unlinked userId → empty array, never error. (TIA-R2)
 * CC not found → empty array (cross-tenant isolation). (TIA-R7)
 * Specs: TIA-R4, TIA-R7
 */
import { Injectable } from '@nestjs/common';
import type { SubjectAssignmentRepository, TeacherRepository } from '@educandow/domain';
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
    private readonly teacherRepo: TeacherRepository,
    private readonly assignmentRepo: SubjectAssignmentRepository,
  ) {}

  async execute(input: { userId: string; courseCycleId: string }): Promise<TeacherSubjectEntry[]> {
    // 1. Resolve Teacher (TIA-R2: null → empty)
    const teacher = await this.teacherRepo.findByUserId(input.userId);
    if (!teacher) return [];

    // 2. Get CourseCycle.courseId (= CourseSection.id) to filter assignments
    const client = TenantContext.getClient();
    if (!client) return [];

    const cc = await client.courseCycle.findUnique({
      where: { uuid: input.courseCycleId },
      select: { courseId: true, studyPlanId: true },
    });
    if (!cc) return [];  // cross-tenant or not-found

    // 3. Get teacher's assignments, filter to those in this CC's course section
    const allAssignments = await this.assignmentRepo.findByTeacher(teacher.id.get());
    const ccAssignments = allAssignments.filter((a) => a.courseSectionId === cc.courseId);

    if (ccAssignments.length === 0) return [];

    // 4. Fetch subject names from the tenant DB
    const subjectIds = ccAssignments.map((a) => a.subjectId);
    const subjects = await client.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    // 5. Bulk-resolve studyPlanSubjectId for each subject (needed by front-end competency channel).
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
