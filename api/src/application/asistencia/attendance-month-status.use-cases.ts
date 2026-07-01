/**
 * Get/Open/CloseAttendanceMonthUseCase — application use-cases (fase-bimestre-cierre-asistencia, PR-3b).
 *
 * Capacidad B (cierre mensual de asistencia). ORTOGONAL a Capacidad A — nunca lee
 * GradingPhase/CourseCycle.gradingPhase (AC-B-15).
 *
 * Authorization: rank gate (Secretario+, rank>=40) is enforced at the controller
 * via @Rank(40) + RankGuard (mirrors SetGradingPhaseUseCase — no re-check here).
 * Reopening is permitted unconditionally for Secretario+, even when a later month
 * has already been generated (design §B1 — no extra guard beyond rank).
 *
 * Absence of a row means OPEN (default-open, no cutover — design §B1).
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError, AttendanceMonthStatus } from '@educandow/domain';
import type { AttendanceMonthStatusRepository } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Types ──────────────────────────────────────────────────

export interface AttendanceMonthStatusResult {
  courseCycleId: string;
  year: number;
  month: number;
  closed: boolean;
  closedAt: Date | null;
  closedBy: string | null;
}

export interface GetAttendanceMonthStatusInput {
  courseCycleId: string;
  year: number;
  month: number;
}

export interface SetAttendanceMonthStatusInput extends GetAttendanceMonthStatusInput {
  userId: string;
}

// ── Shared helpers ─────────────────────────────────────────

async function assertCourseCycleExists(courseCycleId: string): Promise<void> {
  const client = TenantContext.getClient();
  if (!client) {
    throw new NotFoundError('CourseCycle', courseCycleId);
  }
  const cc = await client.courseCycle.findUnique({
    where: { uuid: courseCycleId },
    select: { uuid: true },
  });
  if (!cc) {
    throw new NotFoundError('CourseCycle', courseCycleId);
  }
}

function toResult(status: AttendanceMonthStatus): AttendanceMonthStatusResult {
  return {
    courseCycleId: status.courseCycleId,
    year: status.year,
    month: status.month,
    closed: status.closed,
    closedAt: status.closedAt,
    closedBy: status.closedBy,
  };
}

// ── Use Cases ──────────────────────────────────────────────

@Injectable()
export class GetAttendanceMonthStatusUseCase {
  constructor(private readonly repo: AttendanceMonthStatusRepository) {}

  async execute(input: GetAttendanceMonthStatusInput): Promise<AttendanceMonthStatusResult> {
    const { courseCycleId, year, month } = input;
    await assertCourseCycleExists(courseCycleId);

    const status = await this.repo.findOne(courseCycleId, year, month);
    if (!status) {
      // Absence of a row = OPEN (default-open, no cutover — design §B1)
      return { courseCycleId, year, month, closed: false, closedAt: null, closedBy: null };
    }
    return toResult(status);
  }
}

@Injectable()
export class CloseAttendanceMonthUseCase {
  constructor(private readonly repo: AttendanceMonthStatusRepository) {}

  async execute(input: SetAttendanceMonthStatusInput): Promise<AttendanceMonthStatusResult> {
    const { courseCycleId, year, month, userId } = input;
    await assertCourseCycleExists(courseCycleId);

    let status = await this.repo.findOne(courseCycleId, year, month);
    if (!status) {
      status = AttendanceMonthStatus.create({ courseCycleId, year, month });
    }
    status.close(userId);
    await this.repo.upsert(status);

    return toResult(status);
  }
}

@Injectable()
export class OpenAttendanceMonthUseCase {
  constructor(private readonly repo: AttendanceMonthStatusRepository) {}

  async execute(input: SetAttendanceMonthStatusInput): Promise<AttendanceMonthStatusResult> {
    const { courseCycleId, year, month, userId } = input;
    await assertCourseCycleExists(courseCycleId);

    let status = await this.repo.findOne(courseCycleId, year, month);
    if (!status) {
      status = AttendanceMonthStatus.create({ courseCycleId, year, month });
    }
    // Reopening is permitted even when a later month has already been generated
    // (design §B1) — no extra guard here beyond the controller's rank gate.
    status.open(userId);
    await this.repo.upsert(status);

    return toResult(status);
  }
}
