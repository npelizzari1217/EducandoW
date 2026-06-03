import { Injectable } from '@nestjs/common';
import { CarreraRepository, Carrera, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface CarreraRow {
  id: string;
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string | null;
  active: boolean;
  deletedAt?: Date | null;
}

@Injectable()
export class PrismaCarreraRepository implements CarreraRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Carrera | null> {
    const r = await this.client.carrera.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findAll(): Promise<Carrera[]> {
    const rs = await this.client.carrera.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(carrera: Carrera): Promise<void> {
    await this.client.carrera.upsert({
      where: { id: carrera.id.get() },
      create: {
        id: carrera.id.get(),
        name: carrera.name,
        titulo: carrera.titulo,
        duracion: carrera.duracion,
        resolucion: carrera.resolucion,
        active: carrera.active,
        deletedAt: carrera.deletedAt,
      },
      update: {
        name: carrera.name,
        titulo: carrera.titulo,
        duracion: carrera.duracion,
        resolucion: carrera.resolucion,
        active: carrera.active,
        deletedAt: carrera.deletedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.carrera.delete({ where: { id } });
  }

  private toDomain(r: CarreraRow): Carrera {
    return Carrera.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      titulo: r.titulo,
      duracion: r.duracion,
      resolucion: r.resolucion ?? undefined,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
    });
  }
}
