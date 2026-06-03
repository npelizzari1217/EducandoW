import { Injectable } from '@nestjs/common';
import { NotaRepository, Nota, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, Nota as PrismaNota } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaNotaRepo implements NotaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Nota | null> {
    const r = await this.client.nota.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByEvaluation(evaluationId: string): Promise<Nota[]> {
    const rs = await this.client.nota.findMany({
      where: { evaluationId },
      orderBy: { studentId: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByStudent(studentId: string): Promise<Nota[]> {
    const rs = await this.client.nota.findMany({
      where: { studentId },
      orderBy: { registeredAt: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(n: Nota): Promise<void> {
    // If gradeScaleValueId is provided, load the GradeScaleValue and populate snapshot fields
    let gradeCode: string | undefined = n.gradeCode;
    let gradeLabel: string | undefined = n.gradeLabel;
    let isApproved: boolean | undefined = n.isApproved;

    if (n.gradeScaleValueId && (!gradeCode || !gradeLabel)) {
      const gsv = await this.client.gradeScaleValue.findUnique({ where: { id: n.gradeScaleValueId } });
      if (gsv) {
        gradeCode = gradeCode ?? gsv.code;
        gradeLabel = gradeLabel ?? gsv.label;
        isApproved = isApproved ?? gsv.isApproved;
      }
    }

    await this.client.nota.upsert({
      where: { id: n.id.get() },
      create: {
        id: n.id.get(),
        evaluationId: n.evaluationId,
        studentId: n.studentId,
        numericValue: n.numericValue,
        qualitativeValue: n.qualitativeValue,
        comments: n.comments,
        registeredAt: n.registeredAt,
        gradeScaleValueId: n.gradeScaleValueId,
        gradeCode,
        gradeLabel,
        isApproved,
      },
      update: {
        numericValue: n.numericValue,
        qualitativeValue: n.qualitativeValue,
        comments: n.comments,
        registeredAt: n.registeredAt,
        gradeScaleValueId: n.gradeScaleValueId,
        gradeCode,
        gradeLabel,
        isApproved,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.nota.delete({ where: { id } });
  }

  private toDomain(r: PrismaNota): Nota {
    return Nota.reconstruct({
      id: Id.reconstruct(r.id),
      evaluationId: r.evaluationId,
      studentId: r.studentId,
      numericValue: r.numericValue ?? undefined,
      qualitativeValue: r.qualitativeValue ?? undefined,
      comments: r.comments ?? undefined,
      registeredAt: r.registeredAt,
      gradeScaleValueId: r.gradeScaleValueId ?? undefined,
      gradeCode: r.gradeCode ?? undefined,
      gradeLabel: r.gradeLabel ?? undefined,
      isApproved: r.isApproved ?? undefined,
    });
  }
}
