import { Injectable } from '@nestjs/common';
import { GradeRepository, Grade, GradeStatus, Id } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaGradeRepo implements GradeRepository {
  constructor(private readonly p: PrismaService) {}
  async findById(id: string) { const r = await this.p.grade.findUnique({ where: { id } }); return r ? this.toDomain(r) : null; }
  async findByStudent(sid: string) { const rs = await this.p.grade.findMany({ where: { studentId: sid }, orderBy: { evaluatedAt: 'desc' } }); return rs.map(r => this.toDomain(r)); }
  async findBySubjectAndStudent(subid: string, sid: string) { const rs = await this.p.grade.findMany({ where: { subjectId: subid, studentId: sid }, orderBy: { period: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async findByCourseSection(csid: string) { const rs = await this.p.grade.findMany({ where: { courseSectionId: csid }, orderBy: { studentId: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async save(g: Grade) { await this.p.grade.upsert({ where: { id: g.id.get() }, create: { id: g.id.get(), studentId: g.studentId, subjectId: g.subjectId, courseSectionId: g.courseSectionId, period: g.period, numericValue: g.numericValue, qualitativeValue: g.qualitativeValue, status: g.status, evaluatedAt: g.evaluatedAt }, update: { period: g.period, numericValue: g.numericValue, qualitativeValue: g.qualitativeValue, status: g.status, evaluatedAt: g.evaluatedAt } }); }
  async delete(id: string) { await this.p.grade.delete({ where: { id } }).catch(() => {}); }
  private toDomain(r: Record<string, unknown>) { return Grade.reconstruct({ id: Id.reconstruct(r.id as string), studentId: r.studentId as string, subjectId: r.subjectId as string, courseSectionId: r.courseSectionId as string, period: r.period as string, numericValue: r.numericValue as number | undefined, qualitativeValue: r.qualitativeValue as string | undefined, status: r.status as GradeStatus | undefined, evaluatedAt: new Date(r.evaluatedAt as string) }); }
}
