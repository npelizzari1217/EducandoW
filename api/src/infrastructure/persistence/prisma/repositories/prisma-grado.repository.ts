import { Injectable } from '@nestjs/common';
import { GradoRepository, Grado, GradoNumero, Division, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Grado as PrismaGrado } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaGradoRepository implements GradoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Grado | null> {
    const record = await this.client.grado.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(academicYear?: string): Promise<Grado[]> {
    const records = await this.client.grado.findMany({
      where: {
        active: true,
        deletedAt: null,
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: [{ grade: 'asc' }, { division: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(grado: Grado): Promise<void> {
    await this.client.grado.upsert({
      where: { id: grado.id.get() },
      create: {
        id: grado.id.get(),
        courseSectionId: grado.courseSectionId ?? null,
        grade: grado.grade.value,
        division: grado.division.value,
        teacherId: grado.teacherId ?? null,
        academicYear: grado.academicYear,
        active: grado.active,
        deletedAt: grado.deletedAt ?? null,
      },
      update: {
        courseSectionId: grado.courseSectionId ?? null,
        grade: grado.grade.value,
        division: grado.division.value,
        teacherId: grado.teacherId ?? null,
        academicYear: grado.academicYear,
        active: grado.active,
        deletedAt: grado.deletedAt ?? null,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.grado.delete({ where: { id } });
  }

  private toDomain(record: PrismaGrado): Grado {
    const gradeResult = GradoNumero.create(record.grade);
    const divisionResult = Division.create(record.division);

    if (gradeResult.isErr() || divisionResult.isErr()) {
      throw new Error(`Invalid Grado data in DB: id=${record.id}`);
    }

    return Grado.reconstruct({
      id: Id.reconstruct(record.id),
      courseSectionId: record.courseSectionId ?? undefined,
      grade: gradeResult.unwrap(),
      division: divisionResult.unwrap(),
      teacherId: record.teacherId ?? undefined,
      academicYear: record.academicYear,
      active: record.active,
      deletedAt: record.deletedAt ?? undefined,
    });
  }
}
