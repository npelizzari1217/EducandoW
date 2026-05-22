import { Injectable } from '@nestjs/common';
import { SubjectAssignmentRepository, SubjectAssignment, Id } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaSubjectAssignmentRepo implements SubjectAssignmentRepository {
  constructor(private readonly p: PrismaService) {}
  async findById(id: string) { const r = await this.p.subjectAssignment.findUnique({ where: { id } }); return r ? this.toDomain(r) : null; }
  async findBySubject(sid: string) { const rs = await this.p.subjectAssignment.findMany({ where: { subjectId: sid } }); return rs.map(r => this.toDomain(r)); }
  async findByTeacher(tid: string) { const rs = await this.p.subjectAssignment.findMany({ where: { teacherId: tid } }); return rs.map(r => this.toDomain(r)); }
  async findByCourseSection(csid: string) { const rs = await this.p.subjectAssignment.findMany({ where: { courseSectionId: csid } }); return rs.map(r => this.toDomain(r)); }
  async save(a: SubjectAssignment) { await this.p.subjectAssignment.upsert({ where: { id: a.id.get() }, create: { id: a.id.get(), subjectId: a.subjectId, teacherId: a.teacherId, courseSectionId: a.courseSectionId }, update: { subjectId: a.subjectId, teacherId: a.teacherId, courseSectionId: a.courseSectionId } }); }
  async delete(id: string) { await this.p.subjectAssignment.delete({ where: { id } }).catch(() => {}); }
  private toDomain(r: Record<string, unknown>) { return SubjectAssignment.reconstruct({ id: Id.reconstruct(r.id as string), subjectId: r.subjectId as string, teacherId: r.teacherId as string, courseSectionId: r.courseSectionId as string }); }
}
