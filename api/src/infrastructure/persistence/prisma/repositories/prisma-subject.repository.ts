import { Injectable } from '@nestjs/common';
import { SubjectRepository, Subject, Id, Level, LevelType } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Subject as PrismaSubject } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaSubjectRepo implements SubjectRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Subject | null> {
    const r = await this.client.subject.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByInstitution(_iid: string): Promise<Subject[]> {
    const rs = await this.client.subject.findMany({ orderBy: { name: 'asc' } });
    return rs.map((r) => this.toDomain(r));
  }

  async findByLevel(_iid: string, l: LevelType): Promise<Subject[]> {
    const rs = await this.client.subject.findMany({
      where: { level: l as number },
      orderBy: { name: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(s: Subject): Promise<void> {
    await this.client.subject.upsert({
      where: { id: s.id.get() },
      create: { id: s.id.get(), name: s.name, level: s.level.toCode() },
      update: { name: s.name, level: s.level.toCode() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.subject.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaSubject): Subject {
    return Subject.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      level: Level.create(r.level).unwrap(),
      institutionId: TenantContext.getInstitutionId() ?? '',
    });
  }
}
