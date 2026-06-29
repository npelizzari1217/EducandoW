import { Injectable } from '@nestjs/common';
import { StudentRepository, Student, Id, Dni, Email } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Student | null> {
    const record = await this.client.student.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByInstitution(_institutionId: string): Promise<Student[]> {
    const records = await this.client.student.findMany({
      orderBy: { lastName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByDni(dni: string): Promise<Student | null> {
    const record = await this.client.student.findUnique({ where: { dni } });
    return record ? this.toDomain(record) : null;
  }

  async findByUserId(userId: string): Promise<Student | null> {
    const record = await this.client.student.findFirst({ where: { userId } });
    return record ? this.toDomain(record) : null;
  }

  async findByGuardianUserId(guardianUserId: string): Promise<Student[]> {
    const records = await this.client.student.findMany({
      where: {
        guardians: {
          some: { userId: guardianUserId },
        },
      },
      orderBy: { lastName: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async search(_institutionId: string, query: string): Promise<Student[]> {
    const records = await this.client.student.findMany({
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

  async save(student: Student): Promise<void> {
    await this.client.student.upsert({
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
        motherName: student.motherName,
        fatherDni: student.fatherDni,
        motherDni: student.motherDni,
        fatherEmail: student.fatherEmail?.get() ?? null,
        motherEmail: student.motherEmail?.get() ?? null,
        address: student.address,
        phone: student.phone,
        photoUrl: student.photoUrl,
        userId: student.userId,
      },
      update: {
        firstName: student.firstName,
        lastName: student.lastName,
        dni: student.dni.get(),
        email: student.email?.get(),
        birthDate: student.birthDate,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        motherName: student.motherName,
        fatherDni: student.fatherDni,
        motherDni: student.motherDni,
        fatherEmail: student.fatherEmail?.get() ?? null,
        motherEmail: student.motherEmail?.get() ?? null,
        address: student.address,
        phone: student.phone,
        photoUrl: student.photoUrl,
        userId: student.userId,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.student.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });
  }

  async setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void> {
    await this.client.student.update({ where: { id: studentId }, data: { fechaDePase } });
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
      motherName: record.motherName as string | undefined,
      fatherDni: record.fatherDni as string | undefined,
      motherDni: record.motherDni as string | undefined,
      fatherEmail: record.fatherEmail ? Email.reconstruct(record.fatherEmail as string) : undefined,
      motherEmail: record.motherEmail ? Email.reconstruct(record.motherEmail as string) : undefined,
      address: record.address as string | undefined,
      phone: record.phone as string | undefined,
      photoUrl: record.photoUrl as string | undefined,
      userId: record.userId as string | undefined,
      institutionId: Id.create(TenantContext.getInstitutionId() || undefined),
      active: (record.active as boolean) ?? true,
      deletedAt: record.deletedAt ? new Date(record.deletedAt as string) : undefined,
      fechaDePase: record.fechaDePase ? new Date(record.fechaDePase as string) : undefined,
    });
  }
}
