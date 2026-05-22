import { Injectable } from '@nestjs/common';
import { EnrollmentRepository, Enrollment, EnrollmentStatus, Id, Level, LevelType } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Enrollment | null> {
    const record = await this.prisma.enrollment.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByStudent(studentId: string): Promise<Enrollment[]> {
    const records = await this.prisma.enrollment.findMany({
      where: { studentId },
      orderBy: { academicYear: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByInstitution(institutionId: string): Promise<Enrollment[]> {
    const records = await this.prisma.enrollment.findMany({
      where: { institutionId },
      orderBy: [{ academicYear: 'desc' }, { level: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActive(studentId: string): Promise<Enrollment | null> {
    const record = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
    });
    return record ? this.toDomain(record) : null;
  }

  async save(enrollment: Enrollment): Promise<void> {
    await this.prisma.enrollment.upsert({
      where: { id: enrollment.id.get() },
      create: {
        id: enrollment.id.get(),
        studentId: enrollment.studentId.get(),
        institutionId: enrollment.institutionId.get(),
        level: enrollment.level.toString(),
        academicYear: enrollment.academicYear,
        grade: enrollment.grade,
        division: enrollment.division,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      },
      update: {
        studentId: enrollment.studentId.get(),
        institutionId: enrollment.institutionId.get(),
        level: enrollment.level.toString(),
        academicYear: enrollment.academicYear,
        grade: enrollment.grade,
        division: enrollment.division,
        status: enrollment.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.enrollment.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: Record<string, unknown>): Enrollment {
    return Enrollment.reconstruct({
      id: Id.reconstruct(record.id as string),
      studentId: Id.reconstruct(record.studentId as string),
      institutionId: Id.reconstruct(record.institutionId as string),
      level: Level.reconstruct(record.level as LevelType),
      academicYear: record.academicYear as string,
      grade: record.grade as string | undefined,
      division: record.division as string | undefined,
      status: record.status as EnrollmentStatus,
      enrolledAt: new Date(record.enrolledAt as string),
    });
  }
}
