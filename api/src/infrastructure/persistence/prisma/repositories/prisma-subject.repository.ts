import { Injectable } from '@nestjs/common';
import { SubjectRepository, Subject, Id } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaSubjectRepo implements SubjectRepository {
  constructor(private readonly p: PrismaService) {}
  async findById(id: string) { const r = await this.p.subject.findUnique({ where: { id } }); return r ? this.toDomain(r) : null; }
  async findByInstitution(iid: string) { const rs = await this.p.subject.findMany({ where: { institutionId: iid }, orderBy: { name: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async findByLevel(iid: string, l: string) { const rs = await this.p.subject.findMany({ where: { institutionId: iid, level: l }, orderBy: { name: 'asc' } }); return rs.map(r => this.toDomain(r)); }
  async save(s: Subject) { await this.p.subject.upsert({ where: { id: s.id.get() }, create: { id: s.id.get(), name: s.name, level: s.level, institutionId: s.institutionId }, update: { name: s.name, level: s.level } }); }
  async delete(id: string) { await this.p.subject.delete({ where: { id } }).catch(() => {}); }
  private toDomain(r: Record<string, unknown>) { return Subject.reconstruct({ id: Id.reconstruct(r.id as string), name: r.name as string, level: r.level as string, institutionId: r.institutionId as string }); }
}
