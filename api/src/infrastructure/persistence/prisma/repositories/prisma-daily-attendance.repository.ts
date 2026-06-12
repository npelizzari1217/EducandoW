/**
 * PrismaDailyAttendanceRepository — tenant-scoped persistence (Fase 6, F6-I2).
 * Implements DailyAttendanceRepository via TenantContext.
 */
import { Injectable } from '@nestjs/common';
import type { DailyAttendanceRepository } from '@educandow/domain';
import { AsistenciaDiaria } from '@educandow/domain';
import { Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AsistenciaDiariaRow = {
  id: string;
  courseCycleId: string;
  studentId: string;
  date: Date;
  statusCode: string;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaDailyAttendanceRepository implements DailyAttendanceRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  async record(data: {
    courseCycleId: string;
    studentId: string;
    date: Date;
    statusCode: string;
    observaciones?: string;
  }): Promise<AsistenciaDiaria> {
    const row = await this.client.asistenciaDiaria.upsert({
      where: {
        courseCycleId_studentId_date: {
          courseCycleId: data.courseCycleId,
          studentId: data.studentId,
          date: data.date,
        },
      },
      create: {
        courseCycleId: data.courseCycleId,
        studentId: data.studentId,
        date: data.date,
        statusCode: data.statusCode,
        observaciones: data.observaciones ?? null,
      },
      update: {
        statusCode: data.statusCode,
        observaciones: data.observaciones ?? null,
      },
    });
    return this.toDomain(row);
  }

  async findByCourseAndDate(courseCycleId: string, date: Date): Promise<AsistenciaDiaria[]> {
    const rows = await this.client.asistenciaDiaria.findMany({
      where: { courseCycleId, date },
      orderBy: { studentId: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByCourseAndStudent(courseCycleId: string, studentId: string): Promise<AsistenciaDiaria[]> {
    const rows = await this.client.asistenciaDiaria.findMany({
      where: { courseCycleId, studentId },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: AsistenciaDiariaRow): AsistenciaDiaria {
    return AsistenciaDiaria.reconstruct({
      id: Id.reconstruct(row.id),
      courseCycleId: row.courseCycleId,
      studentId: row.studentId,
      date: row.date,
      statusCode: row.statusCode,
      observaciones: row.observaciones ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
