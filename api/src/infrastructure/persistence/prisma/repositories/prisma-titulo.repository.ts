import { Injectable } from '@nestjs/common';
import { TituloRepository, Titulo, EstadoTitulo, Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface TituloRow {
  id: string;
  studentId: string;
  carreraId: string;
  fechaEgreso?: Date | null;
  fechaEmision?: Date | null;
  estado: string;
  nroRegistro?: string | null;
}

@Injectable()
export class PrismaTituloRepository implements TituloRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<Titulo | null> {
    const r = await this.client.titulo.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudent(studentId: string): Promise<Titulo[]> {
    const rs = await this.client.titulo.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<Titulo[]> {
    const rs = await this.client.titulo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async save(titulo: Titulo): Promise<void> {
    await this.client.titulo.upsert({
      where: { id: titulo.id.get() },
      create: {
        id: titulo.id.get(),
        studentId: titulo.studentId,
        carreraId: titulo.carreraId,
        fechaEgreso: titulo.fechaEgreso,
        fechaEmision: titulo.fechaEmision,
        estado: titulo.estado.get(),
        nroRegistro: titulo.nroRegistro,
      },
      update: {
        fechaEgreso: titulo.fechaEgreso,
        fechaEmision: titulo.fechaEmision,
        estado: titulo.estado.get(),
        nroRegistro: titulo.nroRegistro,
      },
    });
  }

  private toDomain(r: TituloRow): Titulo {
    return Titulo.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      carreraId: r.carreraId,
      fechaEgreso: r.fechaEgreso ?? undefined,
      fechaEmision: r.fechaEmision ?? undefined,
      estado: EstadoTitulo.create(r.estado),
      nroRegistro: r.nroRegistro ?? undefined,
    });
  }
}
