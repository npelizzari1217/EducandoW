import { Injectable } from '@nestjs/common';
import { TeacherRepository, Teacher, Id, Dni, Email } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaTeacherRepository implements TeacherRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Teacher | null> {
    const record = await this.prisma.teacher.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByInstitution(institutionId: string): Promise<Teacher[]> {
    const records = await this.prisma.teacher.findMany({
      where: { institutionId },
      orderBy: { lastName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByDni(dni: string): Promise<Teacher | null> {
    const record = await this.prisma.teacher.findUnique({ where: { dni } });
    return record ? this.toDomain(record) : null;
  }

  async search(institutionId: string, query: string): Promise<Teacher[]> {
    const records = await this.prisma.teacher.findMany({
      where: {
        institutionId,
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
    await this.prisma.teacher.upsert({
      where: { id: teacher.id.get() },
      create: {
        id: teacher.id.get(),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        dni: teacher.dni.get(),
        email: teacher.email.get(),
        phone: teacher.phone,
        title: teacher.title,
        institutionId: teacher.institutionId ?? '',
      },
      update: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        dni: teacher.dni.get(),
        email: teacher.email.get(),
        phone: teacher.phone,
        title: teacher.title,
        institutionId: teacher.institutionId ?? '',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.teacher.delete({ where: { id } }).catch(() => {});
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
      institutionId: record.institutionId as string,
    });
  }
}
