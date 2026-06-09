import { Injectable } from '@nestjs/common';
import {
  SubjectFinalGrade,
  SubjectFinalGradeType,
  SubjectFinalGradeRepository,
} from '@educandow/domain';
import type { GradeInternalStatusValue } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, $Enums } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaSubjectFinalGradeRepository
  implements SubjectFinalGradeRepository
{
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findByCourseCycleAndSubject(
    courseCycleId: string,
    subjectId: string,
  ): Promise<SubjectFinalGrade[]> {
    const rows = await this.client.subjectFinalGrade.findMany({
      where: { courseCycleId, subjectId },
      orderBy: [{ studentId: 'asc' }, { type: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByStudentAndCourseCycle(
    studentId: string,
    courseCycleId: string,
  ): Promise<SubjectFinalGrade[]> {
    const rows = await this.client.subjectFinalGrade.findMany({
      where: { studentId, courseCycleId },
      orderBy: [{ subjectId: 'asc' }, { type: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  /**
   * Batch upserts keyed on (studentId, courseCycleId, subjectId, type).
   * ALL fields are written in BOTH create and update branches — no field silently dropped.
   * (Round-trip regression lesson from PR1 teacher-identity review — AD-2.)
   */
  async saveMany(grades: SubjectFinalGrade[]): Promise<void> {
    for (const grade of grades) {
      // Map domain enum to Prisma enum (same string values — safe cast)
      const prismaType = grade.type as unknown as $Enums.SubjectFinalGradeType;

      const data = {
        studentId:         grade.studentId,
        courseCycleId:     grade.courseCycleId,
        subjectId:         grade.subjectId,
        type:              prismaType,
        gradeScaleValueId: grade.gradeScaleValueId,
        gradeCode:         grade.gradeCode,
        internalStatus:    grade.internalStatus as $Enums.GradeInternalStatus | null,
        passed:            grade.passed,
      };

      await this.client.subjectFinalGrade.upsert({
        where: {
          studentId_courseCycleId_subjectId_type: {
            studentId:     grade.studentId,
            courseCycleId: grade.courseCycleId,
            subjectId:     grade.subjectId,
            type:          prismaType,
          },
        },
        create: { id: grade.id, ...data },
        update: data,
      });
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toDomain(r: {
    id:                string;
    studentId:         string;
    courseCycleId:     string;
    subjectId:         string;
    type:              string;
    gradeScaleValueId: string | null;
    gradeCode:         string | null;
    internalStatus:    string | null;
    passed:            boolean | null;
  }): SubjectFinalGrade {
    return SubjectFinalGrade.reconstruct({
      id:                r.id,
      studentId:         r.studentId,
      courseCycleId:     r.courseCycleId,
      subjectId:         r.subjectId,
      type:              r.type as SubjectFinalGradeType,
      gradeScaleValueId: r.gradeScaleValueId,
      gradeCode:         r.gradeCode,
      internalStatus:    (r.internalStatus as GradeInternalStatusValue) ?? null,
      passed:            r.passed,
    });
  }
}
