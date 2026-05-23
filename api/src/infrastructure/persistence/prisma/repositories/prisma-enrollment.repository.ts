import { Injectable } from '@nestjs/common';
import { EnrollmentRepository, Enrollment, EnrollmentStatus, Id, Level } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Enrollment as PrismaEnrollment } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Enrollment | null> {
    const record = await this.client.enrollment.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByStudent(studentId: string): Promise<Enrollment[]> {
    const records = await this.client.enrollment.findMany({
      where: { studentId },
      orderBy: { academicYear: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByInstitution(_institutionId: string): Promise<Enrollment[]> {
    const records = await this.client.enrollment.findMany({
      orderBy: [{ academicYear: 'desc' }, { level: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActive(studentId: string): Promise<Enrollment | null> {
    const record = await this.client.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
    });
    return record ? this.toDomain(record) : null;
  }

  async save(enrollment: Enrollment): Promise<void> {
    await this.client.enrollment.upsert({
      where: { id: enrollment.id.get() },
      create: {
        id: enrollment.id.get(),
        studentId: enrollment.studentId.get(),
        level: enrollment.level.toCode(),
        academicYear: enrollment.academicYear,
        grade: enrollment.grade,
        division: enrollment.division,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      },
      update: {
        studentId: enrollment.studentId.get(),
        level: enrollment.level.toCode(),
        academicYear: enrollment.academicYear,
        grade: enrollment.grade,
        division: enrollment.division,
        status: enrollment.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.enrollment.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: PrismaEnrollment): Enrollment {
    const institutionId = TenantContext.getInstitutionId() ?? '';
    return Enrollment.reconstruct({
      id: Id.reconstruct(record.id),
      studentId: Id.reconstruct(record.studentId),
      institutionId: Id.reconstruct(institutionId || '00000000-0000-0000-0000-000000000000'),
      level: Level.create(record.level).unwrap(),
      academicYear: record.academicYear,
      grade: record.grade ?? undefined,
      division: record.division ?? undefined,
      status: record.status as EnrollmentStatus,
      enrolledAt: record.enrolledAt,
    });
  }
}
