import { Injectable } from '@nestjs/common';
import { GradeRepository, Grade, GradeStatus, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Grade as PrismaGrade } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaGradeRepo implements GradeRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Grade | null> {
    const r = await this.client.grade.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudent(sid: string): Promise<Grade[]> {
    const rs = await this.client.grade.findMany({
      where: { studentId: sid },
      orderBy: { evaluatedAt: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findBySubjectAndStudent(subid: string, sid: string): Promise<Grade[]> {
    const rs = await this.client.grade.findMany({
      where: { subjectId: subid, studentId: sid },
      orderBy: { period: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByCourseSection(csid: string): Promise<Grade[]> {
    const rs = await this.client.grade.findMany({
      where: { courseSectionId: csid },
      orderBy: { studentId: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(g: Grade): Promise<void> {
    await this.client.grade.upsert({
      where: { id: g.id.get() },
      create: {
        id: g.id.get(),
        studentId: g.studentId,
        subjectId: g.subjectId,
        courseSectionId: g.courseSectionId,
        period: g.period,
        numericValue: g.numericValue,
        qualitativeValue: g.qualitativeValue,
        status: g.status,
        evaluatedAt: g.evaluatedAt,
      },
      update: {
        period: g.period,
        numericValue: g.numericValue,
        qualitativeValue: g.qualitativeValue,
        status: g.status,
        evaluatedAt: g.evaluatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.grade.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaGrade): Grade {
    return Grade.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      subjectId: r.subjectId,
      courseSectionId: r.courseSectionId,
      period: r.period,
      numericValue: r.numericValue ?? undefined,
      qualitativeValue: r.qualitativeValue ?? undefined,
      status: (r.status as GradeStatus) ?? undefined,
      evaluatedAt: r.evaluatedAt,
    });
  }
}
