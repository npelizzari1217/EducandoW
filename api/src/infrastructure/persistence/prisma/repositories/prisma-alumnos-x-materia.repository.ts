import { Injectable } from '@nestjs/common';
import {
  AlumnosXMateriaXCursoXCiclo,
  AlumnosXMateriaRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AlumnosXMateriaRow = {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaAlumnosXMateriaRepository — tenant-scoped persistence (Fase 3b, F3-I2).
 * Manages the authoritative universe of students per subject per CourseCycle.
 */
@Injectable()
export class PrismaAlumnosXMateriaRepository implements AlumnosXMateriaRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findByMateria(materiaXCursoXCicloId: string): Promise<AlumnosXMateriaXCursoXCiclo[]> {
    const rows = await this.client.alumnosXMateriaXCursoXCiclo.findMany({
      where: { materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<AlumnosXMateriaXCursoXCiclo | null> {
    const row = await this.client.alumnosXMateriaXCursoXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Add a student to the universe. Idempotent via @@unique([materiaXCursoXCicloId, studentId]).
   * If the record already exists, returns the existing one.
   */
  async addStudent(
    materiaXCursoXCicloId: string,
    studentId: string
  ): Promise<AlumnosXMateriaXCursoXCiclo> {
    const now = new Date();
    const row = await this.client.alumnosXMateriaXCursoXCiclo.upsert({
      where: {
        materiaXCursoXCicloId_studentId: { materiaXCursoXCicloId, studentId },
      },
      create: { materiaXCursoXCicloId, studentId, createdAt: now, updatedAt: now },
      update: { updatedAt: now },
    });
    return this.toDomain(row);
  }

  async isMember(materiaXCursoXCicloId: string, studentId: string): Promise<boolean> {
    const count = await this.client.alumnosXMateriaXCursoXCiclo.count({
      where: { materiaXCursoXCicloId, studentId },
    });
    return count > 0;
  }

  /**
   * Bulk-upsert for backfill (skipDuplicates). Does not return records.
   */
  async upsertMany(
    data: Array<{ materiaXCursoXCicloId: string; studentId: string }>
  ): Promise<void> {
    await this.client.alumnosXMateriaXCursoXCiclo.createMany({
      data: data.map((d) => ({
        materiaXCursoXCicloId: d.materiaXCursoXCicloId,
        studentId: d.studentId,
      })),
      skipDuplicates: true,
    });
  }

  private toDomain(row: AlumnosXMateriaRow): AlumnosXMateriaXCursoXCiclo {
    return AlumnosXMateriaXCursoXCiclo.reconstruct({
      id: row.id,
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      studentId: row.studentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
