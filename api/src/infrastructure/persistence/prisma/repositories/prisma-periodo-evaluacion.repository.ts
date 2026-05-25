import { Injectable } from '@nestjs/common';
import { PeriodoEvaluacionRepository, PeriodoEvaluacion, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, PeriodoEvaluacion as PrismaPeriodoEvaluacion } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaPeriodoEvaluacionRepo implements PeriodoEvaluacionRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<PeriodoEvaluacion | null> {
    const r = await this.client.periodoEvaluacion.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByAcademicYear(academicYear: string): Promise<PeriodoEvaluacion[]> {
    const rs = await this.client.periodoEvaluacion.findMany({
      where: { academicYear },
      orderBy: { startDate: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(p: PeriodoEvaluacion): Promise<void> {
    await this.client.periodoEvaluacion.upsert({
      where: { id: p.id.get() },
      create: {
        id: p.id.get(),
        academicYear: p.academicYear,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
      },
      update: {
        academicYear: p.academicYear,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.periodoEvaluacion.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(r: PrismaPeriodoEvaluacion): PeriodoEvaluacion {
    return PeriodoEvaluacion.reconstruct({
      id: Id.reconstruct(r.id),
      academicYear: r.academicYear,
      name: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
    });
  }
}
