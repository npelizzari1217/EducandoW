import { Injectable } from '@nestjs/common';
import {
  CursoRepository,
  Curso,
  Orientacion,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { Id } from '@educandow/domain';
import { TenantContext } from '../../../auth/tenant.context';

interface CursoRow {
  id: string;
  courseSectionId: string | null;
  year: number;
  division: string;
  orientacion: string | null;
  academicYear: string;
  active: boolean;
  deletedAt: Date | null;
}

@Injectable()
export class PrismaCursoRepository implements CursoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Curso | null> {
    const record = await this.client.curso.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(academicYear?: string): Promise<Curso[]> {
    const records = await this.client.curso.findMany({
      where: {
        active: true,
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: [{ year: 'asc' }, { division: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(curso: Curso): Promise<void> {
    await this.client.curso.upsert({
      where: { id: curso.id.get() },
      create: {
        id: curso.id.get(),
        courseSectionId: curso.courseSectionId ?? null,
        year: curso.year,
        division: curso.division,
        orientacion: curso.orientacion?.get() ?? null,
        academicYear: curso.academicYear,
        active: curso.active,
        deletedAt: curso.deletedAt ?? null,
      },
      update: {
        courseSectionId: curso.courseSectionId ?? null,
        year: curso.year,
        division: curso.division,
        orientacion: curso.orientacion?.get() ?? null,
        academicYear: curso.academicYear,
        active: curso.active,
        deletedAt: curso.deletedAt ?? null,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.curso.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: CursoRow): Curso {
    return Curso.reconstruct({
      id: Id.reconstruct(record.id),
      courseSectionId: record.courseSectionId ?? undefined,
      year: record.year,
      division: record.division,
      orientacion: record.orientacion ? Orientacion.reconstruct(record.orientacion as import('@educandow/domain').OrientacionCode) : undefined,
      academicYear: record.academicYear,
      active: record.active,
      deletedAt: record.deletedAt ?? undefined,
    });
  }
}
