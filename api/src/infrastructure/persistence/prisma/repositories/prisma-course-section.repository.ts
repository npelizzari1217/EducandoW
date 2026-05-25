import { Injectable } from '@nestjs/common';
import { CourseSectionRepository, CourseSection, Id, Level, LevelType, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, CourseSection as PrismaCourseSection } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaCourseSectionRepo implements CourseSectionRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<CourseSection | null> {
    const r = await this.client.courseSection.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByInstitution(_iid: string): Promise<CourseSection[]> {
    const rs = await this.client.courseSection.findMany({ orderBy: { name: 'asc' } });
    return rs.map((r) => this.toDomain(r));
  }

  async findByLevel(_iid: string, l: LevelType, ay: string): Promise<CourseSection[]> {
    // Filter by composite level — fetch all and filter in-memory
    const rs = await this.client.courseSection.findMany({
      where: { academicYear: ay },
      orderBy: { name: 'asc' },
    });
    return rs.map((r) => this.toDomain(r)).filter((s) => s.level.get() === l);
  }

  async save(s: CourseSection): Promise<void> {
    await this.client.courseSection.upsert({
      where: { id: s.id.get() },
      create: {
        id: s.id.get(),
        name: s.name,
        grade: s.grade,
        division: s.division,
        level: s.levelCode,
        modality: s.modalityCode,
        academicYear: s.academicYear,
      },
      update: {
        name: s.name,
        grade: s.grade,
        division: s.division,
        level: s.levelCode,
        modality: s.modalityCode,
        academicYear: s.academicYear,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.courseSection.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaCourseSection): CourseSection {
    const modality = (r as any).modality ?? EducationalModalityCode.COMUN;
    return CourseSection.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      grade: r.grade ?? undefined,
      division: r.division ?? undefined,
      level: Level.fromParts(
        r.level as EducationalLevelCode,
        modality as EducationalModalityCode,
      ),
      academicYear: r.academicYear,
      institutionId: TenantContext.getInstitutionId() ?? '',
    });
  }
}
