import { Injectable } from '@nestjs/common';
import { SubjectAssignmentRepository, SubjectAssignment, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, SubjectAssignment as PrismaSubjectAssignment } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaSubjectAssignmentRepo implements SubjectAssignmentRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<SubjectAssignment | null> {
    const r = await this.client.subjectAssignment.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findBySubject(sid: string): Promise<SubjectAssignment[]> {
    const rs = await this.client.subjectAssignment.findMany({ where: { subjectId: sid } });
    return rs.map((r) => this.toDomain(r));
  }

  async findByTeacher(tid: string): Promise<SubjectAssignment[]> {
    const rs = await this.client.subjectAssignment.findMany({ where: { teacherId: tid } });
    return rs.map((r) => this.toDomain(r));
  }

  async findByCourseSection(csid: string): Promise<SubjectAssignment[]> {
    const rs = await this.client.subjectAssignment.findMany({ where: { courseSectionId: csid } });
    return rs.map((r) => this.toDomain(r));
  }

  async save(a: SubjectAssignment): Promise<void> {
    await this.client.subjectAssignment.upsert({
      where: { id: a.id.get() },
      create: {
        id: a.id.get(),
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        courseSectionId: a.courseSectionId,
      },
      update: {
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        courseSectionId: a.courseSectionId,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.subjectAssignment.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaSubjectAssignment): SubjectAssignment {
    return SubjectAssignment.reconstruct({
      id: Id.reconstruct(r.id),
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      courseSectionId: r.courseSectionId,
    });
  }
}
