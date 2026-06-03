import { Injectable } from '@nestjs/common';
import { EvaluacionRepository, Evaluacion, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Evaluacion as PrismaEvaluacion } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaEvaluacionRepo implements EvaluacionRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Evaluacion | null> {
    const r = await this.client.evaluacion.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByAssignment(assignmentId: string): Promise<Evaluacion[]> {
    const rs = await this.client.evaluacion.findMany({
      where: { assignmentId },
      orderBy: { evaluationDate: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(e: Evaluacion): Promise<void> {
    await this.client.evaluacion.upsert({
      where: { id: e.id.get() },
      create: {
        id: e.id.get(),
        assignmentId: e.assignmentId,
        title: e.title,
        description: e.description,
        evaluationDate: e.evaluationDate,
        weight: e.weight,
      },
      update: {
        assignmentId: e.assignmentId,
        title: e.title,
        description: e.description,
        evaluationDate: e.evaluationDate,
        weight: e.weight,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.evaluacion.delete({ where: { id } });
  }

  private toDomain(r: PrismaEvaluacion): Evaluacion {
    return Evaluacion.reconstruct({
      id: Id.reconstruct(r.id),
      assignmentId: r.assignmentId,
      title: r.title,
      description: r.description ?? undefined,
      evaluationDate: r.evaluationDate,
      weight: r.weight,
    });
  }
}
