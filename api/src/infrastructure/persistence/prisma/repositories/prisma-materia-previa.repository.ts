import { Injectable } from '@nestjs/common';
import {
  MateriaPrevia,
  MateriaPreviaRepository,
  MateriaPreviaStatus,
  SubjectFinalGradeCondicion,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, $Enums } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaMateriaPreviaRepository implements MateriaPreviaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findByStudent(studentId: string): Promise<MateriaPrevia[]> {
    const rows = await this.client.materiaPrevia.findMany({
      where: { studentId },
      orderBy: [{ originAcademicYear: 'asc' }, { subjectId: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByStudentAndAcademicYear(
    studentId: string,
    academicYear: string,
  ): Promise<MateriaPrevia[]> {
    const rows = await this.client.materiaPrevia.findMany({
      where: { studentId, originAcademicYear: academicYear },
      orderBy: [{ subjectId: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  /**
   * Batch upserts keyed on (studentId, subjectId, originAcademicYear).
   * ALL fields are written in BOTH create and update branches — no field silently dropped.
   * (Mirrors PrismaSubjectFinalGradeRepository upsert convention.)
   */
  async saveMany(items: MateriaPrevia[]): Promise<void> {
    for (const item of items) {
      const data = {
        studentId:          item.studentId,
        subjectId:          item.subjectId,
        originAcademicYear: item.originAcademicYear,
        originCourseCycleId: item.originCourseCycleId ?? null,
        condicion:          item.condicion as $Enums.SubjectFinalGradeCondicion,
        status:             item.status as $Enums.MateriaPreviaStatus,
        resolvedGradeCode:  item.resolvedGradeCode ?? null,
        resolvedAt:         item.resolvedAt ?? null,
        updatedAt:          item.updatedAt,
      };

      await this.client.materiaPrevia.upsert({
        where: {
          studentId_subjectId_originAcademicYear: {
            studentId:          item.studentId,
            subjectId:          item.subjectId,
            originAcademicYear: item.originAcademicYear,
          },
        },
        create: {
          id:        item.id,
          createdAt: item.createdAt,
          ...data,
        },
        update: data,
      });
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toDomain(r: {
    id:                  string;
    studentId:           string;
    subjectId:           string;
    originAcademicYear:  string;
    originCourseCycleId: string | null;
    condicion:           string;
    status:              string;
    resolvedGradeCode:   string | null;
    resolvedAt:          Date | null;
    createdAt:           Date;
    updatedAt:           Date;
  }): MateriaPrevia {
    return MateriaPrevia.reconstruct({
      id:                  r.id,
      studentId:           r.studentId,
      subjectId:           r.subjectId,
      originAcademicYear:  r.originAcademicYear,
      originCourseCycleId: r.originCourseCycleId ?? undefined,
      condicion:           r.condicion as SubjectFinalGradeCondicion,
      status:              r.status as MateriaPreviaStatus,
      resolvedGradeCode:   r.resolvedGradeCode ?? undefined,
      resolvedAt:          r.resolvedAt ?? undefined,
      createdAt:           r.createdAt,
      updatedAt:           r.updatedAt,
    });
  }
}
