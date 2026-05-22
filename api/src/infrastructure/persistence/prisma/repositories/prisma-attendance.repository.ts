import { Injectable } from '@nestjs/common';
import { AttendanceRepository, Attendance, AttendanceStatus, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Attendance as PrismaAttendance } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaAttendanceRepo implements AttendanceRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Attendance | null> {
    const r = await this.client.attendance.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudent(sid: string): Promise<Attendance[]> {
    const rs = await this.client.attendance.findMany({
      where: { studentId: sid },
      orderBy: { date: 'desc' },
      take: 100,
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByCourseSectionAndDate(csid: string, date: Date): Promise<Attendance[]> {
    const rs = await this.client.attendance.findMany({
      where: { courseSectionId: csid, date },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByStudentAndDate(sid: string, date: Date): Promise<Attendance | null> {
    const r = await this.client.attendance.findFirst({
      where: { studentId: sid, date },
    });
    return r ? this.toDomain(r) : null;
  }

  async save(a: Attendance): Promise<void> {
    await this.client.attendance.upsert({
      where: { id: a.id.get() },
      create: {
        id: a.id.get(),
        studentId: a.studentId,
        courseSectionId: a.courseSectionId,
        date: a.date,
        status: a.status,
        note: a.note,
      },
      update: {
        status: a.status,
        note: a.note,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.attendance.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaAttendance): Attendance {
    return Attendance.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      courseSectionId: r.courseSectionId,
      date: r.date,
      status: r.status as AttendanceStatus,
      note: r.note ?? undefined,
    });
  }
}
