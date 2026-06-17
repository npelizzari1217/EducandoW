import { Injectable } from '@nestjs/common';
import {
  AsignacionCursoXCiclo,
  AsignacionCursoXCicloRepository,
  RolCurso,
  TurnoCurso,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AsignacionRow = {
  id: string;
  courseCycleId: string;
  docenteXCicloId: string;
  rol: string;
  turno: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaAsignacionCursoXCicloRepository — tenant-scoped persistence (Fase 4, F4-I1).
 * Same TenantContext pattern as other Fase 2/3 repositories.
 */
@Injectable()
export class PrismaAsignacionCursoXCicloRepository
  implements AsignacionCursoXCicloRepository
{
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async assign(data: {
    courseCycleId: string;
    docenteXCicloId: string;
    rol: RolCurso;
    turno?: TurnoCurso;
  }): Promise<AsignacionCursoXCiclo> {
    const row = await this.client.asignacionCursoXCiclo.create({
      data: {
        courseCycleId: data.courseCycleId,
        docenteXCicloId: data.docenteXCicloId,
        rol: data.rol,
        turno: data.turno ?? null,
      },
    });
    return this.toDomain(row);
  }

  async findByCourseId(courseCycleId: string): Promise<AsignacionCursoXCiclo[]> {
    const rows = await this.client.asignacionCursoXCiclo.findMany({
      where: { courseCycleId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByCourseAndDocente(
    courseCycleId: string,
    docenteXCicloId: string,
  ): Promise<AsignacionCursoXCiclo[]> {
    const rows = await this.client.asignacionCursoXCiclo.findMany({
      where: { courseCycleId, docenteXCicloId },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async isPreceptor(docenteXCicloId: string, courseCycleId: string): Promise<boolean> {
    const row = await this.client.asignacionCursoXCiclo.findFirst({
      where: { courseCycleId, docenteXCicloId, rol: RolCurso.PRECEPTOR },
    });
    return row !== null;
  }

  async remove(id: string): Promise<void> {
    await this.client.asignacionCursoXCiclo.delete({ where: { id } });
  }

  async removeTitularesForCourse(courseCycleId: string): Promise<void> {
    await this.client.asignacionCursoXCiclo.deleteMany({
      where: { courseCycleId, rol: RolCurso.TITULAR },
    });
  }

  async findTitularCourseIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.client.asignacionCursoXCiclo.findMany({
      where: {
        rol: RolCurso.TITULAR,
        docenteXCiclo: { userId, active: true },
      },
      select: { courseCycleId: true },
    });
    return [...new Set(rows.map((r) => r.courseCycleId))];
  }

  private toDomain(row: AsignacionRow): AsignacionCursoXCiclo {
    return AsignacionCursoXCiclo.reconstruct({
      id: row.id,
      courseCycleId: row.courseCycleId,
      docenteXCicloId: row.docenteXCicloId,
      rol: row.rol as RolCurso,
      turno: row.turno ? (row.turno as TurnoCurso) : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
