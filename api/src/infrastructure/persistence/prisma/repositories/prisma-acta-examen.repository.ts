import { Injectable } from '@nestjs/common';
import { ActaExamenRepository, ActaExamen, CondicionExamen, IntentoFinal, Id } from '@educandow/domain';
import type { ActaExamenNota as ActaExamenNotaDomain } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface ActaExamenRow {
  id: string;
  materiaCarreraId: string;
  fecha: Date;
  presidenteId: string;
  vocales: string[];
  libro?: string | null;
  folio?: string | null;
  active: boolean;
  deletedAt?: Date | null;
  notas?: ActaExamenNotaRow[];
}

interface ActaExamenNotaRow {
  id: string;
  actaId: string;
  studentId: string;
  nota: number;
  condicion: string;
  intento: number;
}

@Injectable()
export class PrismaActaExamenRepository implements ActaExamenRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<ActaExamen | null> {
    const r = await this.client.actaExamen.findUnique({
      where: { id },
      include: { notas: true },
    });
    return r ? this.toDomain(r as ActaExamenRow) : null;
  }

  async findByMateriaCarrera(materiaCarreraId: string): Promise<ActaExamen[]> {
    const rs = await this.client.actaExamen.findMany({
      where: { materiaCarreraId, active: true },
      include: { notas: true },
      orderBy: { fecha: 'desc' },
    });
    return rs.map((r) => this.toDomain(r as ActaExamenRow));
  }

  async findAll(): Promise<ActaExamen[]> {
    const rs = await this.client.actaExamen.findMany({
      where: { active: true },
      include: { notas: true },
      orderBy: { fecha: 'desc' },
    });
    return rs.map((r) => this.toDomain(r as ActaExamenRow));
  }

  async save(acta: ActaExamen): Promise<void> {
    await this.client.actaExamen.upsert({
      where: { id: acta.id.get() },
      create: {
        id: acta.id.get(),
        materiaCarreraId: acta.materiaCarreraId,
        fecha: acta.fecha,
        presidenteId: acta.presidenteId,
        vocales: acta.vocales,
        libro: acta.libro,
        folio: acta.folio,
        active: acta.active,
        deletedAt: acta.deletedAt,
      },
      update: {
        materiaCarreraId: acta.materiaCarreraId,
        fecha: acta.fecha,
        presidenteId: acta.presidenteId,
        vocales: acta.vocales,
        libro: acta.libro,
        folio: acta.folio,
        active: acta.active,
        deletedAt: acta.deletedAt,
      },
    });
  }

  async saveNota(actaId: string, studentId: string, nota: number, condicion: string, intento: number): Promise<void> {
    await this.client.actaExamenNota.upsert({
      where: { actaId_studentId: { actaId, studentId } },
      create: { actaId, studentId, nota, condicion, intento },
      update: { nota, condicion, intento },
    });
  }

  async countIntentosFinal(studentId: string, materiaCarreraId: string): Promise<number> {
    return this.client.actaExamenNota.count({
      where: {
        studentId,
        condicion: { in: ['DESAPROBADO', 'AUSENTE'] },
        acta: { materiaCarreraId },
      },
    });
  }

  private toDomain(r: ActaExamenRow): ActaExamen {
    const notas: ActaExamenNotaDomain[] = (r.notas ?? []).map((n: ActaExamenNotaRow) => ({
      id: n.id,
      actaId: n.actaId,
      studentId: n.studentId,
      nota: n.nota,
      condicion: CondicionExamen.create(n.condicion),
      intento: IntentoFinal.create(n.intento ?? 1),
    }));

    return ActaExamen.reconstruct({
      id: Id.reconstruct(r.id),
      materiaCarreraId: r.materiaCarreraId,
      fecha: r.fecha,
      presidenteId: r.presidenteId,
      vocales: r.vocales,
      libro: r.libro ?? undefined,
      folio: r.folio ?? undefined,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
      notas,
    });
  }
}
