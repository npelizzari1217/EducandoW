import { Injectable } from '@nestjs/common';
import {
  MesaExamenRepository,
  MesaExamen,
  TurnoExamen,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface MesaExamenRow {
  id: string;
  subjectId: string;
  fecha: Date;
  turno: string;
  presidenteId: string;
  active: boolean;
  deletedAt: Date | null;
  inscripciones: MesaExamenInscripcionRow[];
}

interface MesaExamenInscripcionRow {
  id: string;
  mesaId: string;
  studentId: string;
  notaFinal: number | null;
  condicionFinal: string;
}

@Injectable()
export class PrismaMesaExamenRepository implements MesaExamenRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<MesaExamen | null> {
    const record = await this.client.mesaExamen.findUnique({
      where: { id },
      include: { inscripciones: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(subjectId?: string): Promise<MesaExamen[]> {
    const records = await this.client.mesaExamen.findMany({
      where: {
        active: true,
        ...(subjectId ? { subjectId } : {}),
      },
      include: { inscripciones: true },
      orderBy: { fecha: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(mesa: MesaExamen): Promise<void> {
    await this.client.mesaExamen.upsert({
      where: { id: mesa.id.get() },
      create: {
        id: mesa.id.get(),
        subjectId: mesa.subjectId,
        fecha: mesa.fecha,
        turno: mesa.turno.get(),
        presidenteId: mesa.presidenteId,
        active: mesa.active,
        deletedAt: mesa.deletedAt ?? null,
      },
      update: {
        subjectId: mesa.subjectId,
        fecha: mesa.fecha,
        turno: mesa.turno.get(),
        presidenteId: mesa.presidenteId,
        active: mesa.active,
        deletedAt: mesa.deletedAt ?? null,
      },
    });
  }

  async saveInscripcion(mesaId: string, studentId: string): Promise<void> {
    await this.client.mesaExamenInscripcion.create({
      data: {
        id: Id.create().get(),
        mesaId,
        studentId,
        condicionFinal: 'AUSENTE',
      },
    });
  }

  private toDomain(record: MesaExamenRow): MesaExamen {
    return MesaExamen.reconstruct({
      id: Id.reconstruct(record.id),
      subjectId: record.subjectId,
      fecha: record.fecha,
      turno: TurnoExamen.reconstruct(record.turno as import('@educandow/domain').TurnoExamenCode),
      presidenteId: record.presidenteId,
      inscripciones: record.inscripciones.map((i) => ({
        id: Id.reconstruct(i.id),
        mesaId: i.mesaId,
        studentId: i.studentId,
        notaFinal: i.notaFinal ?? undefined,
        condicionFinal: i.condicionFinal,
      })),
      active: record.active,
      deletedAt: record.deletedAt ?? undefined,
    });
  }
}
