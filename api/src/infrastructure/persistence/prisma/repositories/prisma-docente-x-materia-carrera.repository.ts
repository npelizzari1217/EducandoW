import { Injectable } from '@nestjs/common';
import { DocenteXMateriaCarrera, DocenteXMateriaCarreraRepository } from '@educandow/domain';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaDocenteXMateriaCarreraRepository implements DocenteXMateriaCarreraRepository {
  private get client() {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findActiveAssignment(
    userId: string,
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<DocenteXMateriaCarrera | null> {
    const row = await this.client.docenteXMateriaCarrera.findFirst({
      where: { userId, materiaCarreraId, anioAcademico, active: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAny(
    userId: string,
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<DocenteXMateriaCarrera | null> {
    const row = await this.client.docenteXMateriaCarrera.findFirst({
      where: { userId, materiaCarreraId, anioAcademico },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<DocenteXMateriaCarrera | null> {
    const row = await this.client.docenteXMateriaCarrera.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listByMateria(
    materiaCarreraId: string,
    anioAcademico?: string,
  ): Promise<DocenteXMateriaCarrera[]> {
    const where: Record<string, unknown> = { materiaCarreraId, active: true };
    if (anioAcademico !== undefined) where.anioAcademico = anioAcademico;
    const rows = await this.client.docenteXMateriaCarrera.findMany({ where });
    return rows.map((r: Record<string, unknown>) => this.toDomain(r));
  }

  async listByDocente(userId: string): Promise<DocenteXMateriaCarrera[]> {
    const rows = await this.client.docenteXMateriaCarrera.findMany({
      where: { userId, active: true },
    });
    return rows.map((r: Record<string, unknown>) => this.toDomain(r));
  }

  async save(entity: DocenteXMateriaCarrera): Promise<void> {
    await this.client.docenteXMateriaCarrera.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        userId: entity.userId,
        materiaCarreraId: entity.materiaCarreraId,
        anioAcademico: entity.anioAcademico,
        active: entity.active,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      update: {
        active: entity.active,
        updatedAt: entity.updatedAt,
      },
    });
  }

  private toDomain(row: Record<string, unknown>): DocenteXMateriaCarrera {
    return DocenteXMateriaCarrera.reconstruct({
      id: row.id as string,
      userId: row.userId as string,
      materiaCarreraId: row.materiaCarreraId as string,
      anioAcademico: row.anioAcademico as string,
      active: row.active as boolean,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    });
  }
}
