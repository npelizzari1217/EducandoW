import { Injectable } from '@nestjs/common';
import { SubjectRepository, Subject, Id, Level, LevelType, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface SubjectRow {
  id: string;
  name: string;
  level: number;
  institutionId?: string;
  modality?: number;
  active?: boolean;
  deletedAt?: Date | null;
}

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
    // Filter by composite level — we need to fetch all and filter in-memory
    // since level+modality are separate columns now
    const rs = await this.client.subject.findMany({ orderBy: { name: 'asc' } });
    return rs.map((r) => this.toDomain(r)).filter((s) => s.level.get() === l);
  }

  async save(s: Subject): Promise<void> {
    await this.client.subject.upsert({
      where: { id: s.id.get() },
      create: {
        id: s.id.get(),
        name: s.name,
        level: s.levelCode,
        modality: s.modalityCode,
      },
      update: {
        name: s.name,
        level: s.levelCode,
        modality: s.modalityCode,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.subject.delete({ where: { id } });
  }

  private toDomain(r: SubjectRow): Subject {
    const modality = r.modality ?? EducationalModalityCode.COMUN;
    return Subject.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      level: Level.fromParts(
        r.level as EducationalLevelCode,
        modality as EducationalModalityCode,
      ),
      institutionId: Id.reconstruct(TenantContext.getInstitutionId() ?? ''),
      active: r.active ?? true,
      deletedAt: r.deletedAt ?? undefined,
    });
  }
}
