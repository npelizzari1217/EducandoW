import { Injectable } from '@nestjs/common';
import { CalificacionPrimarioRepository, CalificacionPrimario, Trimestre, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient, CalificacionPrimario as PrismaCalificacion } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaCalificacionPrimariaRepository implements CalificacionPrimarioRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<CalificacionPrimario | null> {
    const record = await this.client.calificacionPrimario.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(gradoId?: string, studentId?: string): Promise<CalificacionPrimario[]> {
    const records = await this.client.calificacionPrimario.findMany({
      where: {
        ...(gradoId ? { gradoId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      orderBy: [{ studentId: 'asc' }, { trimestre: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(calificacion: CalificacionPrimario): Promise<void> {
    await this.client.calificacionPrimario.upsert({
      where: { id: calificacion.id.get() },
      create: {
        id: calificacion.id.get(),
        studentId: calificacion.studentId,
        gradoId: calificacion.gradoId,
        subjectId: calificacion.subjectId,
        trimestre: calificacion.trimestre.value,
        nota: calificacion.nota,
        concepto: calificacion.concepto,
        aprobado: calificacion.aprobado,
      },
      update: {
        nota: calificacion.nota,
        concepto: calificacion.concepto,
        aprobado: calificacion.aprobado,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.calificacionPrimario.delete({ where: { id } }).catch(() => {});
  }

  private toDomain(record: PrismaCalificacion): CalificacionPrimario {
    const trimestreResult = Trimestre.create(record.trimestre);
    if (trimestreResult.isErr()) {
      throw new Error(`Invalid CalificacionPrimario data in DB: id=${record.id}`);
    }

    return CalificacionPrimario.reconstruct({
      id: Id.reconstruct(record.id),
      studentId: record.studentId,
      gradoId: record.gradoId,
      subjectId: record.subjectId,
      trimestre: trimestreResult.unwrap(),
      nota: record.nota,
      concepto: record.concepto,
      aprobado: record.aprobado,
    });
  }
}
