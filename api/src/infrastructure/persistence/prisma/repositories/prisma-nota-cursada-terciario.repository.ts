import { Injectable } from '@nestjs/common';
import {
  NotaCursadaTerciarioRepository,
  NotaCursadaTerciario,
  SlotCursadaTerciario,
  CondicionCursada,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface NotaCursadaTerciarioRow {
  id: string;
  inscripcionMateriaId: string;
  slot: string;
  nota: number | null;
  condicion: string;
  fecha: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaNotaCursadaTerciarioRepository implements NotaCursadaTerciarioRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findByInscripcion(inscripcionMateriaId: string): Promise<NotaCursadaTerciario[]> {
    const rows = await this.client.notaCursadaTerciario.findMany({
      where: { inscripcionMateriaId },
    });
    return rows.map((r) => this.toDomain(r as NotaCursadaTerciarioRow));
  }

  async findSlot(inscripcionMateriaId: string, slot: string): Promise<NotaCursadaTerciario | null> {
    const r = await this.client.notaCursadaTerciario.findFirst({
      where: { inscripcionMateriaId, slot },
    });
    return r ? this.toDomain(r as NotaCursadaTerciarioRow) : null;
  }

  async save(entity: NotaCursadaTerciario): Promise<void> {
    await this.client.notaCursadaTerciario.create({
      data: {
        id: entity.id.get(),
        inscripcionMateriaId: entity.inscripcionMateriaId,
        slot: entity.slot.get(),
        nota: entity.nota ?? null,
        condicion: entity.condicion.get(),
        fecha: entity.fecha ?? null,
      },
    });
  }

  async update(entity: NotaCursadaTerciario): Promise<void> {
    await this.client.notaCursadaTerciario.update({
      where: { id: entity.id.get() },
      data: {
        nota: entity.nota ?? null,
        condicion: entity.condicion.get(),
        fecha: entity.fecha ?? null,
      },
    });
  }

  private toDomain(r: NotaCursadaTerciarioRow): NotaCursadaTerciario {
    return NotaCursadaTerciario.reconstruct({
      id: Id.reconstruct(r.id),
      inscripcionMateriaId: r.inscripcionMateriaId,
      slot: SlotCursadaTerciario.create(r.slot),
      nota: r.nota ?? undefined,
      condicion: CondicionCursada.create(r.condicion),
      fecha: r.fecha ?? undefined,
      creadoAt: r.createdAt,
      actualizadoAt: r.updatedAt,
    });
  }
}
