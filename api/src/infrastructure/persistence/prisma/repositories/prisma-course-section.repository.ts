import { Injectable } from '@nestjs/common';
import { CourseSectionRepository, CourseSection, Id } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaCourseSectionRepo implements CourseSectionRepository {
  constructor(private readonly p: PrismaService) {}
  async findById(id: string) { const r = await this.p.courseSection.findUnique({ where: { id } }); return r ? this.toDomain(r) : null; }
  async findByInstitution(iid: string) { const rs = await this.p.courseSection.findMany({ where: { institutionId: iid }, orderBy: { name: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async findByLevel(iid: string, l: string, ay: string) { const rs = await this.p.courseSection.findMany({ where: { institutionId: iid, level: l, academicYear: ay }, orderBy: { name: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async save(s: CourseSection) { await this.p.courseSection.upsert({ where: { id: s.id.get() }, create: { id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level, academicYear: s.academicYear, institutionId: s.institutionId }, update: { name: s.name, grade: s.grade, division: s.division, level: s.level, academicYear: s.academicYear } }); }
  async delete(id: string) { await this.p.courseSection.delete({ where: { id } }).catch(() => {}); }
  private toDomain(r: Record<string, unknown>) { return CourseSection.reconstruct({ id: Id.reconstruct(r.id as string), name: r.name as string, grade: r.grade as string | undefined, division: r.division as string | undefined, level: r.level as string, academicYear: r.academicYear as string, institutionId: r.institutionId as string }); }
}
