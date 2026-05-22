import { Injectable } from '@nestjs/common';
import { AttendanceRepository, Attendance, AttendanceStatus, Id } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaAttendanceRepo implements AttendanceRepository {
  constructor(private readonly p: PrismaService) {}
  async findById(id: string) { const r = await this.p.attendance.findUnique({ where: { id } }); return r ? this.toDomain(r) : null; }
  async findByStudent(sid: string) { const rs = await this.p.attendance.findMany({ where: { studentId: sid }, orderBy: { date: 'desc' }, take: 100 }); return rs.map(r => this.toDomain(r)); }
  async findByCourseSectionAndDate(csid: string, date: Date) { const rs = await this.p.attendance.findMany({ where: { courseSectionId: csid, date } }); return rs.map(r => this.toDomain(r)); }
  async findByStudentAndDate(sid: string, date: Date) { const r = await this.p.attendance.findFirst({ where: { studentId: sid, date } }); return r ? this.toDomain(r) : null; }
  async save(a: Attendance) { await this.p.attendance.upsert({ where: { id: a.id.get() }, create: { id: a.id.get(), studentId: a.studentId, courseSectionId: a.courseSectionId, date: a.date, status: a.status, note: a.note }, update: { status: a.status, note: a.note } }); }
  async delete(id: string) { await this.p.attendance.delete({ where: { id } }).catch(() => {}); }
  private toDomain(r: Record<string, unknown>) { return Attendance.reconstruct({ id: Id.reconstruct(r.id as string), studentId: r.studentId as string, courseSectionId: r.courseSectionId as string, date: new Date(r.date as string), status: r.status as AttendanceStatus, note: r.note as string | undefined }); }
}
