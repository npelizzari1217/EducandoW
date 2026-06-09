import { Injectable } from '@nestjs/common';
import { SubjectPeriodGrade, SubjectPeriodGradeRepository } from '@educandow/domain';
import type { GradeInternalStatusValue } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaSubjectPeriodGradeRepository
  implements SubjectPeriodGradeRepository
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
  ): Promise<SubjectPeriodGrade[]> {
    const rows = await this.client.subjectPeriodGrade.findMany({
      where: { courseCycleId, subjectId },
      orderBy: [{ studentId: 'asc' }, { periodOrdinal: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByStudentAndCourseCycle(
    studentId: string,
    courseCycleId: string,
  ): Promise<SubjectPeriodGrade[]> {
    const rows = await this.client.subjectPeriodGrade.findMany({
      where: { studentId, courseCycleId },
      orderBy: [{ subjectId: 'asc' }, { periodOrdinal: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  /**
   * Batch upserts keyed on (studentId, courseCycleId, subjectId, periodOrdinal).
   * Includes both grade fields AND pa/ppi/pp flags in every write (AD-3).
   */
  async saveMany(grades: SubjectPeriodGrade[]): Promise<void> {
    for (const grade of grades) {
      const data = {
        studentId: grade.studentId,
        courseCycleId: grade.courseCycleId,
        subjectId: grade.subjectId,
        periodOrdinal: grade.periodOrdinal,
        gradeScaleValueId: grade.gradeScaleValueId,
        gradeCode: grade.gradeCode,
        internalStatus: grade.internalStatus,
        pa: grade.pa,
        ppi: grade.ppi,
        pp: grade.pp,
      };

      await this.client.subjectPeriodGrade.upsert({
        where: {
          studentId_courseCycleId_subjectId_periodOrdinal: {
            studentId: grade.studentId,
            courseCycleId: grade.courseCycleId,
            subjectId: grade.subjectId,
            periodOrdinal: grade.periodOrdinal,
          },
        },
        create: { id: grade.id, ...data },
        update: data,
      });
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toDomain(r: {
    id: string;
    studentId: string;
    courseCycleId: string;
    subjectId: string;
    periodOrdinal: number;
    gradeScaleValueId: string | null;
    gradeCode: string | null;
    internalStatus: string | null;
    pa: boolean;
    ppi: boolean;
    pp: boolean;
  }): SubjectPeriodGrade {
    return SubjectPeriodGrade.reconstruct({
      id: r.id,
      studentId: r.studentId,
      courseCycleId: r.courseCycleId,
      subjectId: r.subjectId,
      periodOrdinal: r.periodOrdinal,
      gradeScaleValueId: r.gradeScaleValueId,
      gradeCode: r.gradeCode,
      internalStatus: (r.internalStatus as GradeInternalStatusValue) ?? null,
      pa: r.pa,
      ppi: r.ppi,
      pp: r.pp,
    });
  }
}
