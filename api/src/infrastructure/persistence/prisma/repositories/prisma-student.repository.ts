import { Injectable } from '@nestjs/common';
import { StudentRepository, Student, Id, Dni, Email } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Student | null> {
    const record = await this.prisma.student.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByInstitution(institutionId: string): Promise<Student[]> {
    const records = await this.prisma.student.findMany({
      where: { institutionId },
      orderBy: { lastName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByDni(dni: string): Promise<Student | null> {
    const record = await this.prisma.student.findUnique({ where: { dni } });
    return record ? this.toDomain(record) : null;
  }

  async search(institutionId: string, query: string): Promise<Student[]> {
    const records = await this.prisma.student.findMany({
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

  async save(student: Student): Promise<void> {
    await this.prisma.student.upsert({
      where: { id: student.id.get() },
      create: {
        id: student.id.get(),
        firstName: student.firstName,
        lastName: student.lastName,
        dni: student.dni.get(),
        email: student.email?.get(),
        birthDate: student.birthDate,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        institutionId: student.institutionId ?? '',
      },
      update: {
        firstName: student.firstName,
        lastName: student.lastName,
        dni: student.dni.get(),
        email: student.email?.get(),
        birthDate: student.birthDate,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        institutionId: student.institutionId ?? '',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.student.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: Record<string, unknown>): Student {
    return Student.reconstruct({
      id: Id.reconstruct(record.id as string),
      firstName: record.firstName as string,
      lastName: record.lastName as string,
      dni: Dni.reconstruct(record.dni as string),
      email: record.email ? Email.reconstruct(record.email as string) : undefined,
      birthDate: record.birthDate ? new Date(record.birthDate as string) : undefined,
      guardianName: record.guardianName as string | undefined,
      guardianPhone: record.guardianPhone as string | undefined,
      institutionId: record.institutionId as string,
    });
  }
}
