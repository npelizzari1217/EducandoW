import { Injectable } from '@nestjs/common';
import { AttendanceRepository, Attendance, AttendanceStatusCode, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Attendance as PrismaAttendance, AttendanceStatus as PrismaAttendanceStatus } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaAttendanceRepo implements AttendanceRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Attendance | null> {
    const r = await this.client.attendance.findUnique({ where: { id }, include: { status: true } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudent(sid: string): Promise<Attendance[]> {
    const rs = await this.client.attendance.findMany({
      where: { studentId: sid },
      orderBy: { date: 'desc' },
      take: 100,
      include: { status: true },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByCourseSectionAndDate(csid: string, date: Date): Promise<Attendance[]> {
    const rs = await this.client.attendance.findMany({
      where: { courseSectionId: csid, date },
      include: { status: true },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByStudentAndDate(sid: string, date: Date): Promise<Attendance | null> {
    const r = await this.client.attendance.findFirst({
      where: { studentId: sid, date },
      include: { status: true },
    });
    return r ? this.toDomain(r) : null;
  }

  async save(a: Attendance): Promise<void> {
    // Resolve status code → UUID for the FK
    const statusCode = a.statusId; // domain entity stores the code as statusId
    const statusRecord = await this.client.attendanceStatus.findUnique({ where: { code: statusCode } });
    if (!statusRecord) throw new Error(`AttendanceStatus not found for code: ${statusCode}`);

    // Populate snapshot fields from the current status record
    const statusCodeSnapshot = a.statusCode ?? statusRecord.code;
    const statusDescription = a.statusDescription ?? statusRecord.description;
    const absenceValue = a.absenceValue ?? statusRecord.absenceValue;
    const isPresent = a.isPresent ?? statusRecord.isPresent;

    await this.client.attendance.upsert({
      where: { id: a.id.get() },
      create: {
        id: a.id.get(),
        studentId: a.studentId,
        courseSectionId: a.courseSectionId,
        cycleId: a.cycleId,
        date: a.date,
        statusId: statusRecord.id,
        note: a.note,
        statusCode: statusCodeSnapshot,
        statusDescription,
        absenceValue,
        isPresent,
      },
      update: {
        statusId: statusRecord.id,
        note: a.note,
        statusCode: statusCodeSnapshot,
        statusDescription,
        absenceValue,
        isPresent,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.attendance.delete({ where: { id } });
  }

  private toDomain(r: PrismaAttendance & { status?: PrismaAttendanceStatus | null }): Attendance {
    return Attendance.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      courseSectionId: r.courseSectionId,
      cycleId: r.cycleId ?? undefined,
      date: r.date,
      statusId: r.status?.code ?? 'PRE',
      status: r.status ? {
        id: r.status.id,
        code: r.status.code as AttendanceStatusCode,
        description: r.status.description,
        absenceValue: r.status.absenceValue,
        isPresent: r.status.isPresent,
        active: r.status.active,
      } : undefined,
      note: r.note ?? undefined,
      statusCode: r.statusCode ?? undefined,
      statusDescription: r.statusDescription ?? undefined,
      absenceValue: r.absenceValue ?? undefined,
      isPresent: r.isPresent ?? undefined,
    });
  }
}
