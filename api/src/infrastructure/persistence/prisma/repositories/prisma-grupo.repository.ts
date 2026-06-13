import { Injectable } from '@nestjs/common';
import {
  GrupoXCursoXMateriaXCiclo,
  GrupoRepository,
} from '@educandow/domain';
import type { GrupoGlobalFilters, GrupoGlobalRow } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type GrupoRow = {
  id: string;
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaGrupoRepository — tenant-scoped persistence (Fase 3b, F3-I3).
 * A group has exactly one DocenteXCiclo (MGC-R3).
 * The @@unique([materiaXCursoXCicloId, docenteXCicloId]) at DB level prevents
 * one docente from having two groups of the same materia.
 */
@Injectable()
export class PrismaGrupoRepository implements GrupoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<GrupoXCursoXMateriaXCiclo | null> {
    const row = await this.client.grupoXCursoXMateriaXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByMateria(materiaXCursoXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByDocente(docenteXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { docenteXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findGroupsForDocente(
    docenteXCicloId: string,
    materiaXCursoXCicloId: string
  ): Promise<GrupoXCursoXMateriaXCiclo[]> {
    const rows = await this.client.grupoXCursoXMateriaXCiclo.findMany({
      where: { docenteXCicloId, materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(data: {
    materiaXCursoXCicloId: string;
    docenteXCicloId: string;
    name?: string;
  }): Promise<GrupoXCursoXMateriaXCiclo> {
    const now = new Date();
    const row = await this.client.grupoXCursoXMateriaXCiclo.create({
      data: {
        materiaXCursoXCicloId: data.materiaXCursoXCicloId,
        docenteXCicloId: data.docenteXCicloId,
        name: data.name ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toDomain(row);
  }

  async findAllGlobal(filters: GrupoGlobalFilters): Promise<GrupoGlobalRow[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Build courseCycle filter nested under materia relation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseCycleWhere: Record<string, any> = {};
    if (filters.courseCycleId) courseCycleWhere.uuid = filters.courseCycleId;
    if (filters.levelIn && filters.levelIn.length > 0) {
      courseCycleWhere.level = { in: filters.levelIn };
    } else if (filters.level !== undefined) {
      courseCycleWhere.level = filters.level;
    }

    if (Object.keys(courseCycleWhere).length > 0) {
      where.materia = { courseCycle: courseCycleWhere };
    }

    if (filters.materiaId) where.materiaXCursoXCicloId = filters.materiaId;

    if (filters.docenteXCicloIds && filters.docenteXCicloIds.length > 0) {
      where.docenteXCicloId = { in: filters.docenteXCicloIds };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (this.client as any).grupoXCursoXMateriaXCiclo.findMany({
      where,
      include: {
        materia: {
          include: {
            courseCycle: { select: { uuid: true, courseName: true, level: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        docenteXCiclo: { select: { id: true, userId: true } },
        alumnos: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((row: any): GrupoGlobalRow => ({
      id: row.id,
      name: row.name ?? undefined,
      docenteXCicloId: row.docenteXCicloId,
      docenteUserId: row.docenteXCiclo.userId,
      materiaId: row.materiaXCursoXCicloId,
      subjectId: row.materia.subjectId,
      subjectName: row.materia.subject.name,
      courseCycleId: row.materia.courseCycle.uuid,
      courseName: row.materia.courseCycle.courseName,
      level: row.materia.courseCycle.level,
      alumnosCount: row.alumnos.length,
    }));
  }

  async update(id: string, data: { name?: string; docenteXCicloId?: string }): Promise<GrupoXCursoXMateriaXCiclo> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.docenteXCicloId !== undefined) updateData.docenteXCicloId = data.docenteXCicloId;

    const row = await this.client.grupoXCursoXMateriaXCiclo.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.client.grupoXCursoXMateriaXCiclo.delete({ where: { id } });
  }

  private toDomain(row: GrupoRow): GrupoXCursoXMateriaXCiclo {
    return GrupoXCursoXMateriaXCiclo.reconstruct({
      id: row.id,
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      docenteXCicloId: row.docenteXCicloId,
      name: row.name ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
