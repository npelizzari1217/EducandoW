/**
 * PR4-T6 [GREEN] — GetSubjectGradesByStudentUseCase.
 * Security fixes (PR4a-SEC): C1 — authz check + scaffold removal.
 *
 * Feeds the "Alumnos por curso" grid. For a (courseCycle, student) pair:
 *   1. Authz: teacher must be homeroom of courseCycleId OR have any subject assignment in it — C1.
 *   2. Resolves all subjects in the CC (via StudyPlan).
 *   3. For each subject: ensures snapshot, fetches existing period grades + finals.
 *   4. Returns ALL competency valuations with imprimible field (no pre-filter) (CORRECTION).
 *
 * SCAFFOLD REMOVED (C1): saveMany of empty grade rows must NOT happen on GET.
 * Absent row = ungraded; rows are created on write (PR4b).
 * ROOT bypasses ownership check.
 * Specs: SFG-R10, ES-R2 (CORRECTED), AD-7
 */
import { Injectable } from '@nestjs/common';
import {
  SubjectFinalGradeType,
} from '@educandow/domain';
import type {
  SubjectGradingPeriodRepository,
  SubjectPeriodGradeRepository,
  SubjectFinalGradeRepository,
  CompetencyValuationRepository,
  CompetencyValuationWithPeriods,
  TeacherRepository,
  SubjectAssignmentRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

const ALL_FINAL_TYPES = [
  SubjectFinalGradeType.FINAL,
  SubjectFinalGradeType.DICIEMBRE,
  SubjectFinalGradeType.MARZO,
  SubjectFinalGradeType.DEFINITIVA,
] as const;

export interface SubjectEntry {
  subjectId: string;
  subjectName: string;
  periods: Array<{ periodOrdinal: number; periodName: string }>;
  periodGrades: Array<{
    periodOrdinal: number;
    gradeScaleValueId: string | null;
    gradeCode: string | null;
    internalStatus: string | null;
    pa: boolean;
    ppi: boolean;
    pp: boolean;
  }>;
  finalGrades: Array<{
    type: string;
    gradeScaleValueId: string | null;
    gradeCode: string | null;
    internalStatus: string | null;
    passed: boolean | null;
  }>;
  competencyValuations: CompetencyValuationWithPeriods[];
}

export interface SubjectGradesByStudentResult {
  courseCycleId: string;
  studentId: string;
  subjects: SubjectEntry[];
}

export type GetSubjectGradesByStudentResponse =
  | SubjectGradesByStudentResult
  | { forbidden: true };

@Injectable()
export class GetSubjectGradesByStudentUseCase {
  constructor(
    private readonly sgpRepo: SubjectGradingPeriodRepository,
    private readonly periodGradeRepo: SubjectPeriodGradeRepository,
    private readonly finalGradeRepo: SubjectFinalGradeRepository,
    private readonly cvRepo: CompetencyValuationRepository,
    private readonly teacherRepo: TeacherRepository,
    private readonly assignmentRepo: SubjectAssignmentRepository,
  ) {}

  async execute(input: {
    courseCycleId: string;
    studentId: string;
    userId: string;
    userRoles: string[];
  }): Promise<GetSubjectGradesByStudentResponse> {
    const { courseCycleId, studentId, userId, userRoles } = input;

    // ── C1: Ownership check ───────────────────────────────────────────────────
    if (!userRoles.includes('ROOT')) {
      const teacher = await this.teacherRepo.findByUserId(userId);
      if (!teacher) return { forbidden: true };

      const client = TenantContext.getClient();
      if (!client) return { forbidden: true };

      const cc = await client.courseCycle.findUnique({
        where: { uuid: courseCycleId },
        select: { courseId: true, homeroomTeacherId: true },
      });
      if (!cc) return { forbidden: true };

      const teacherId = teacher.id.get();
      const isHomeroom = cc.homeroomTeacherId === teacherId;

      let isAssigned = false;
      if (!isHomeroom) {
        const assignments = await this.assignmentRepo.findByTeacher(teacherId);
        isAssigned = assignments.some((a) => a.courseSectionId === cc.courseId);
      }

      if (!isHomeroom && !isAssigned) return { forbidden: true };
    }

    // ── 1. Get subjects for this CC via study plan ────────────────────────────
    const subjectEntries = await this.resolveSubjects(courseCycleId);
    if (subjectEntries.length === 0) {
      return { courseCycleId, studentId, subjects: [] };
    }

    // ── 2. Fetch all period grades + finals for this student × CC ─────────────
    const allPeriodGrades = await this.periodGradeRepo.findByStudentAndCourseCycle(
      studentId,
      courseCycleId,
    );
    const allFinalGrades = await this.finalGradeRepo.findByStudentAndCourseCycle(
      studentId,
      courseCycleId,
    );

    // Index by subjectId
    const pgBySubject = new Map<string, typeof allPeriodGrades[0][]>();
    for (const g of allPeriodGrades) {
      const bucket = pgBySubject.get(g.subjectId) ?? [];
      bucket.push(g);
      pgBySubject.set(g.subjectId, bucket);
    }

    const fgBySubject = new Map<string, Map<string, typeof allFinalGrades[0]>>();
    for (const f of allFinalGrades) {
      if (!fgBySubject.has(f.subjectId)) {
        fgBySubject.set(f.subjectId, new Map());
      }
      fgBySubject.get(f.subjectId)!.set(f.type, f);
    }

    // ── 3. Per-subject: ensure snapshot + competency data ─────────────────────
    // C1 fix: NO saveMany — grade rows are created on write (PR4b), not on read.
    const subjects: SubjectEntry[] = [];

    for (const { subjectId: sid, subjectName, studyPlanSubjectId } of subjectEntries) {
      // Ensure snapshot (idempotent period-structure)
      const periods = await this.sgpRepo.ensureSnapshot(courseCycleId, sid);

      // Existing period grades for this student × subject (absent = ungraded)
      const existingPg = pgBySubject.get(sid) ?? [];

      // Existing finals for this student × subject (absent = null values via ALL_FINAL_TYPES)
      const subjectFinalMap = fgBySubject.get(sid) ?? new Map();

      // Competency valuations (ALL — no imprimible filter per ES-R2 correction)
      let cvs: CompetencyValuationWithPeriods[] = [];
      if (studyPlanSubjectId) {
        const allCvs = await this.cvRepo.findByCourseCycleAndStudyPlanSubject(
          courseCycleId,
          studyPlanSubjectId,
        );
        cvs = allCvs.filter((cv) => cv.studentId === studentId);
      }

      subjects.push({
        subjectId: sid,
        subjectName,
        periods: periods.map((p) => ({ periodOrdinal: p.periodOrdinal, periodName: p.periodName })),
        periodGrades: existingPg.map((g) => ({
          periodOrdinal: g.periodOrdinal,
          gradeScaleValueId: g.gradeScaleValueId,
          gradeCode: g.gradeCode,
          internalStatus: g.internalStatus,
          pa: g.pa,
          ppi: g.ppi,
          pp: g.pp,
        })),
        finalGrades: ALL_FINAL_TYPES.map((type) => {
          const f = subjectFinalMap.get(type);
          return {
            type,
            gradeScaleValueId: f?.gradeScaleValueId ?? null,
            gradeCode: f?.gradeCode ?? null,
            internalStatus: f?.internalStatus ?? null,
            passed: f?.passed ?? null,
          };
        }),
        competencyValuations: cvs,
      });
    }

    return { courseCycleId, studentId, subjects };
  }

  /**
   * Resolves subjects for a CourseCycle via StudyPlan → StudyPlanCourse → StudyPlanSubject.
   * Returns empty array if CC not found.
   */
  private async resolveSubjects(
    courseCycleId: string,
  ): Promise<Array<{ subjectId: string; subjectName: string; studyPlanSubjectId: string | null }>> {
    const client = TenantContext.getClient();
    if (!client) return [];

    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { studyPlanId: true, courseId: true },
    });
    if (!cc) return [];

    const spc = await client.studyPlanCourse.findFirst({
      where: { studyPlanId: cc.studyPlanId, courseSectionId: cc.courseId },
      select: { id: true },
    });
    if (!spc) return [];

    const spSubjects = await client.studyPlanSubject.findMany({
      where: { studyPlanCourseId: spc.id },
      select: { id: true, subjectId: true, subject: { select: { id: true, name: true } } },
    });

    return spSubjects.map((sps) => ({
      subjectId: sps.subjectId,
      subjectName: (sps.subject as { name: string }).name,
      studyPlanSubjectId: sps.id,
    }));
  }
}
