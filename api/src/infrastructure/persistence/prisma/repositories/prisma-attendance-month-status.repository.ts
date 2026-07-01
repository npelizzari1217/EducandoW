/**
 * PrismaAttendanceMonthStatusRepository — tenant-scoped persistence (fase-bimestre-cierre-asistencia, PR-3b).
 *
 * Implements AttendanceMonthStatusRepository. Capacidad B (cierre mensual de
 * asistencia) — ORTOGONAL a GradingPhase (Capacidad A), tabla separada sin
 * lectura cruzada.
 *
 * All operations use TenantContext.getClient() — never the master PrismaService.
 */
import { Injectable } from '@nestjs/common';
import type { AttendanceMonthStatusRepository } from '@educandow/domain';
import { AttendanceMonthStatus, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AttendanceMonthStatusRow = {
  id: string;
  courseCycleId: string;
  year: number;
  month: number;
  status: string;
  closedAt: Date | null;
  closedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaAttendanceMonthStatusRepository implements AttendanceMonthStatusRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  /** Find the status row for an exact (courseCycleId, year, month). Null if never generated (default open). */
  async findOne(courseCycleId: string, year: number, month: number): Promise<AttendanceMonthStatus | null> {
    const row = await this.client.attendanceMonthStatus.findUnique({
      where: { courseCycleId_year_month: { courseCycleId, year, month } },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Find the row with the greatest (year, month) strictly BEFORE the given
   * (year, month) for this courseCycleId — the latest GENERATED month, not the
   * calendar predecessor (schools may skip months, AC-B-8/9/10).
   */
  async findLatestBefore(
    courseCycleId: string,
    year: number,
    month: number,
  ): Promise<AttendanceMonthStatus | null> {
    const row = await this.client.attendanceMonthStatus.findFirst({
      where: {
        courseCycleId,
        OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Create-or-update the row for (courseCycleId, year, month) from the domain
   * entity's current state. Used both to register a newly generated month
   * (OPEN) and to persist close()/open() transitions.
   */
  async upsert(status: AttendanceMonthStatus): Promise<void> {
    const { courseCycleId, year, month } = status;
    const stateValue = status.isClosed() ? 'CLOSED' : 'OPEN';

    await this.client.attendanceMonthStatus.upsert({
      where: { courseCycleId_year_month: { courseCycleId, year, month } },
      create: {
        courseCycleId,
        year,
        month,
        status: stateValue,
        closedAt: status.closedAt,
        closedBy: status.closedBy,
      },
      update: {
        status: stateValue,
        closedAt: status.closedAt,
        closedBy: status.closedBy,
      },
    });
  }

  private toDomain(row: AttendanceMonthStatusRow): AttendanceMonthStatus {
    return AttendanceMonthStatus.reconstruct({
      id: Id.reconstruct(row.id),
      courseCycleId: row.courseCycleId,
      year: row.year,
      month: row.month,
      closed: row.status === 'CLOSED',
      closedAt: row.closedAt,
      closedBy: row.closedBy,
    });
  }
}
