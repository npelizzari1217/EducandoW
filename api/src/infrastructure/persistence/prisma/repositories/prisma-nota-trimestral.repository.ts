import { Injectable } from '@nestjs/common';
import { NotaTrimestralRepository, NotaTrimestral, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, NotaTrimestral as PrismaNotaTrimestral } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaNotaTrimestralRepo implements NotaTrimestralRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<NotaTrimestral | null> {
    const r = await this.client.notaTrimestral.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudentAndPeriod(studentId: string, periodId: string): Promise<NotaTrimestral[]> {
    const rs = await this.client.notaTrimestral.findMany({
      where: { studentId, periodId },
      orderBy: { assignmentId: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(n: NotaTrimestral): Promise<void> {
    await this.client.notaTrimestral.upsert({
      where: { id: n.id.get() },
      create: {
        id: n.id.get(),
        studentId: n.studentId,
        assignmentId: n.assignmentId,
        periodId: n.periodId,
        finalGrade: n.finalGrade,
        attendancePct: n.attendancePct,
      },
      update: {
        finalGrade: n.finalGrade,
        attendancePct: n.attendancePct,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.notaTrimestral.delete({ where: { id } });
  }

  private toDomain(r: PrismaNotaTrimestral): NotaTrimestral {
    return NotaTrimestral.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      assignmentId: r.assignmentId,
      periodId: r.periodId,
      finalGrade: r.finalGrade,
      attendancePct: r.attendancePct ?? undefined,
    });
  }
}
