import { Injectable } from '@nestjs/common';
import { TeacherRepository, Teacher, Id, Dni, Email } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaTeacherRepository implements TeacherRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Teacher | null> {
    const record = await this.client.teacher.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByInstitution(_institutionId: string): Promise<Teacher[]> {
    const records = await this.client.teacher.findMany({
      orderBy: { lastName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByDni(dni: string): Promise<Teacher | null> {
    const record = await this.client.teacher.findUnique({ where: { dni } });
    return record ? this.toDomain(record) : null;
  }

  async search(_institutionId: string, query: string): Promise<Teacher[]> {
    const records = await this.client.teacher.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { dni: { contains: query } },
        ],
      },
      orderBy: { lastName: 'asc' },
      take: 50,
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(teacher: Teacher): Promise<void> {
    await this.client.teacher.upsert({
      where: { id: teacher.id.get() },
      create: {
        id: teacher.id.get(),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        dni: teacher.dni.get(),
        email: teacher.email.get(),
        phone: teacher.phone,
        title: teacher.title,
        active: teacher.active,
      },
      update: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        dni: teacher.dni.get(),
        email: teacher.email.get(),
        phone: teacher.phone,
        title: teacher.title,
        active: teacher.active,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.teacher.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: Record<string, unknown>): Teacher {
    return Teacher.reconstruct({
      id: Id.reconstruct(record.id as string),
      firstName: record.firstName as string,
      lastName: record.lastName as string,
      dni: Dni.reconstruct(record.dni as string),
      email: Email.reconstruct(record.email as string),
      phone: record.phone as string | undefined,
      title: record.title as string | undefined,
      institutionId: TenantContext.getInstitutionId() ?? '',
      active: (record.active as boolean) ?? true,
      deletedAt: record.deletedAt ? new Date(record.deletedAt as string) : undefined,
    });
  }
}
