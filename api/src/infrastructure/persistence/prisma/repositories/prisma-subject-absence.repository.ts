/**
 * PrismaSubjectAbsenceRepository — tenant-scoped persistence (Fase 6, F6-I1).
 * Implements SubjectAbsenceRepository via TenantContext.
 */
import { Injectable } from '@nestjs/common';
import type { SubjectAbsenceRepository } from '@educandow/domain';
import { AusenciaXGrupo } from '@educandow/domain';
import { Id } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AusenciaRow = {
  id: string;
  grupoId: string;
  studentId: string;
  date: Date;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaSubjectAbsenceRepository implements SubjectAbsenceRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  async record(data: {
    grupoId: string;
    studentId: string;
    date: Date;
    observaciones?: string;
  }): Promise<AusenciaXGrupo> {
    const row = await this.client.ausenciaXGrupo.upsert({
      where: {
        grupoId_studentId_date: {
          grupoId: data.grupoId,
          studentId: data.studentId,
          date: data.date,
        },
      },
      create: {
        grupoId: data.grupoId,
        studentId: data.studentId,
        date: data.date,
        observaciones: data.observaciones ?? null,
      },
      update: {
        observaciones: data.observaciones ?? null,
      },
    });
    return this.toDomain(row);
  }

  async findByGrupoAndDate(grupoId: string, date: Date): Promise<AusenciaXGrupo[]> {
    const rows = await this.client.ausenciaXGrupo.findMany({
      where: { grupoId, date },
      orderBy: { studentId: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByGrupoAndStudent(grupoId: string, studentId: string): Promise<AusenciaXGrupo[]> {
    const rows = await this.client.ausenciaXGrupo.findMany({
      where: { grupoId, studentId },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.client.ausenciaXGrupo.delete({ where: { id } });
  }

  private toDomain(row: AusenciaRow): AusenciaXGrupo {
    return AusenciaXGrupo.reconstruct({
      id: Id.reconstruct(row.id),
      grupoId: row.grupoId,
      studentId: row.studentId,
      date: row.date,
      observaciones: row.observaciones ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
