/**
 * GetSubjectGradesBySubjectUseCase — authz via AssignmentAuthorizer (modelo nuevo).
 *
 * Feeds the "Alumnos por materia" grid. For a (courseCycle, subject) pair:
 *   1. Authz: authorizer.canWriteGrades(userId, userRoles, courseCycleId, subjectId) — C1.
 *      Same source as the write path → GET y POST validan igual.
 *   2. Ensures SubjectGradingPeriod snapshot (AD-5) — idempotent, kept.
 *   3. Fetches existing SubjectPeriodGrade rows (absent = ungraded, grid renders empty cell).
 *   4. Fetches existing SubjectFinalGrade rows (all 4 types, absent = null values).
 *   5. Returns ALL competency valuations with imprimible field exposed (no pre-filter).
 *
 * SCAFFOLD REMOVED (C1): saveMany of empty grade rows must NOT happen on GET.
 * Absent row = ungraded; rows are created on write (PR4b).
 * ROOT/management bypass is handled inside AssignmentAuthorizer (Door 2).
 * Specs: SPG-R8, ES-R1 (CORRECTED), AD-5, AD-7
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
  CourseCycleRepository,
  AssignmentAuthorizerPort,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

const ALL_FINAL_TYPES = [
  SubjectFinalGradeType.FINAL,
  SubjectFinalGradeType.DICIEMBRE,
  SubjectFinalGradeType.MARZO,
  SubjectFinalGradeType.DEFINITIVA,
] as const;

export interface SubjectGradesBySubjectResult {
  courseCycleId: string;
  subjectId: string;
  periods: Array<{ periodOrdinal: number; periodName: string }>;
  students: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
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
      /** Year-end condicion (REGULAR | PREVIA | LIBRE). null for Primario rows or when not set. */
      condicion: string | null;
    }>;
    competencyValuations: CompetencyValuationWithPeriods[];
  }>;
}

export type GetSubjectGradesBySubjectResponse =
  | SubjectGradesBySubjectResult
  | { forbidden: true };

@Injectable()
export class GetSubjectGradesBySubjectUseCase {
  constructor(
    private readonly sgpRepo: SubjectGradingPeriodRepository,
    private readonly periodGradeRepo: SubjectPeriodGradeRepository,
    private readonly finalGradeRepo: SubjectFinalGradeRepository,
    private readonly cvRepo: CompetencyValuationRepository,
    private readonly ccRepo: CourseCycleRepository,
    private readonly authorizer: AssignmentAuthorizerPort,
  ) {}

  async execute(input: {
    courseCycleId: string;
    subjectId: string;
    userId: string;
    userRoles: string[];
  }): Promise<GetSubjectGradesBySubjectResponse> {
    const { courseCycleId, subjectId, userId, userRoles } = input;

    // ── C1: Ownership check via AssignmentAuthorizer (same source as write path) ─
    const canAccess = await this.authorizer.canWriteGrades(userId, userRoles, courseCycleId, subjectId);
    if (!canAccess) return { forbidden: true };

    // ── 1. Ensure snapshot (AD-5) — idempotent period-structure snapshot ──────
    const periods = await this.sgpRepo.ensureSnapshot(courseCycleId, subjectId);

    if (periods.length === 0) {
      return { courseCycleId, subjectId, periods: [], students: [] };
    }

    // ── 2. Get enrolled students ──────────────────────────────────────────────
    const students = await this.ccRepo.findEnrolledStudents(courseCycleId);

    if (students.length === 0) {
      return {
        courseCycleId,
        subjectId,
        periods: periods.map((p) => ({ periodOrdinal: p.periodOrdinal, periodName: p.periodName })),
        students: [],
      };
    }

    // ── 3. Fetch existing SubjectPeriodGrade rows (absent = ungraded) ─────────
    // C1 fix: NO saveMany — grade rows are created on write (PR4b), not on read.
    const existingGrades = await this.periodGradeRepo.findByCourseCycleAndSubject(
      courseCycleId,
      subjectId,
    );

    // ── 4. Fetch existing SubjectFinalGrade rows (absent = null values) ───────
    // C1 fix: NO saveMany — same rationale.
    const allFinals = await this.finalGradeRepo.findByCourseCycleAndSubject(
      courseCycleId,
      subjectId,
    );

    // ── 5. Resolve studyPlanSubjectId + competency valuations ─────────────────
    const studyPlanSubjectId = await this.resolveStudyPlanSubjectId(courseCycleId, subjectId);
    let competencyValuations: CompetencyValuationWithPeriods[] = [];
    if (studyPlanSubjectId) {
      competencyValuations = await this.cvRepo.findByCourseCycleAndStudyPlanSubject(
        courseCycleId,
        studyPlanSubjectId,
      );
    }

    // ── 6. Assemble per-student response ──────────────────────────────────────
    const gradesByStudent = new Map<string, typeof existingGrades[0][]>();
    for (const g of existingGrades) {
      const bucket = gradesByStudent.get(g.studentId) ?? [];
      bucket.push(g);
      gradesByStudent.set(g.studentId, bucket);
    }

    const finalsByStudent = new Map<string, Map<string, typeof allFinals[0]>>();
    for (const f of allFinals) {
      if (!finalsByStudent.has(f.studentId)) {
        finalsByStudent.set(f.studentId, new Map());
      }
      finalsByStudent.get(f.studentId)!.set(f.type, f);
    }

    const cvByStudent = new Map<string, CompetencyValuationWithPeriods[]>();
    for (const cv of competencyValuations) {
      const bucket = cvByStudent.get(cv.studentId) ?? [];
      bucket.push(cv);
      cvByStudent.set(cv.studentId, bucket);
    }

    const studentRows = students.map((student) => {
      const pGrades = (gradesByStudent.get(student.studentId) ?? []).map((g) => ({
        periodOrdinal: g.periodOrdinal,
        gradeScaleValueId: g.gradeScaleValueId,
        gradeCode: g.gradeCode,
        internalStatus: g.internalStatus,
        pa: g.pa,
        ppi: g.ppi,
        pp: g.pp,
      }));

      const studentFinalMap = finalsByStudent.get(student.studentId) ?? new Map();
      const fGrades = ALL_FINAL_TYPES.map((type) => {
        const f = studentFinalMap.get(type);
        return {
          type,
          gradeScaleValueId: f?.gradeScaleValueId ?? null,
          gradeCode: f?.gradeCode ?? null,
          internalStatus: f?.internalStatus ?? null,
          passed: f?.passed ?? null,
          condicion: f?.condicion?.toString() ?? null,
        };
      });

      return {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        periodGrades: pGrades,
        finalGrades: fGrades,
        competencyValuations: cvByStudent.get(student.studentId) ?? [],
      };
    });

    return {
      courseCycleId,
      subjectId,
      periods: periods.map((p) => ({ periodOrdinal: p.periodOrdinal, periodName: p.periodName })),
      students: studentRows,
    };
  }

  /**
   * Resolves the StudyPlanSubject.id for a (courseCycle, subject) pair.
   * Path: CourseCycle.studyPlanId + CourseCycle.courseId → StudyPlanCourse → StudyPlanSubject.
   * Returns null if any step is missing (no competency data available).
   */
  private async resolveStudyPlanSubjectId(
    courseCycleId: string,
    subjectId: string,
  ): Promise<string | null> {
    const client = TenantContext.getClient();
    if (!client) return null;

    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { studyPlanId: true, courseId: true },
    });
    if (!cc) return null;

    const spc = await client.studyPlanCourse.findFirst({
      where: { studyPlanId: cc.studyPlanId, courseSectionId: cc.courseId },
      select: { id: true },
    });
    if (!spc) return null;

    const sps = await client.studyPlanSubject.findFirst({
      where: { studyPlanCourseId: spc.id, subjectId },
      select: { id: true },
    });
    return sps?.id ?? null;
  }
}
