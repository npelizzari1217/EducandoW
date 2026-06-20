import { Injectable } from '@nestjs/common';
import {
  MateriasXAlumnoXCursoXCiclo,
  AlumnosXMateriaRepository,
  type AlumnoMateriaEnriched,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type MateriasXAlumnoRow = {
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

  async findByMateria(materiaXCursoXCicloId: string): Promise<MateriasXAlumnoXCursoXCiclo[]> {
    const rows = await this.client.materiasXAlumnoXCursoXCiclo.findMany({
      where: { materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<MateriasXAlumnoXCursoXCiclo | null> {
    const row = await this.client.materiasXAlumnoXCursoXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Add a student to the universe. Idempotent via @@unique([materiaXCursoXCicloId, studentId]).
   * If the record already exists, returns the existing one.
   */
  async addStudent(
    materiaXCursoXCicloId: string,
    studentId: string
  ): Promise<MateriasXAlumnoXCursoXCiclo> {
    const now = new Date();
    const row = await this.client.materiasXAlumnoXCursoXCiclo.upsert({
      where: {
        materiaXCursoXCicloId_studentId: { materiaXCursoXCicloId, studentId },
      },
      create: { materiaXCursoXCicloId, studentId, createdAt: now, updatedAt: now },
      update: { updatedAt: now },
    });
    return this.toDomain(row);
  }

  async isMember(materiaXCursoXCicloId: string, studentId: string): Promise<boolean> {
    const count = await this.client.materiasXAlumnoXCursoXCiclo.count({
      where: { materiaXCursoXCicloId, studentId },
    });
    return count > 0;
  }

  /**
   * Returns alumnos of a materia enriched with studentId + studentName.
   * Resolution: AlumnosXMateria.studentId → Student name.
   * Throws if no tenant client (surfaces the error instead of silently returning []).
   */
  async findByMateriaEnriched(materiaXCursoXCicloId: string): Promise<AlumnoMateriaEnriched[]> {
    const axmRows = await this.client.materiasXAlumnoXCursoXCiclo.findMany({
      where: { materiaXCursoXCicloId },
      orderBy: { createdAt: 'asc' },
    });
    if (axmRows.length === 0) return [];

    const studentIds = [...new Set(axmRows.map((r: { studentId: string }) => r.studentId))];
    const students = await this.client.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const studentNameMap = new Map<string, string>(
      students.map((s: { id: string; firstName: string; lastName: string }) => [
        s.id,
        `${s.firstName} ${s.lastName}`.trim(),
      ]),
    );

    return axmRows.map((a: { id: string; studentId: string }) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: studentNameMap.get(a.studentId) ?? a.studentId,
    }));
  }

  /**
   * Bulk-upsert (skipDuplicates).
   * Returns `{ count }` = rows actually inserted so callers can compute skipped counts.
   */
  async upsertMany(
    data: Array<{ materiaXCursoXCicloId: string; studentId: string }>
  ): Promise<{ count: number }> {
    const result = await this.client.materiasXAlumnoXCursoXCiclo.createMany({
      data: data.map((d) => ({
        materiaXCursoXCicloId: d.materiaXCursoXCicloId,
        studentId: d.studentId,
      })),
      skipDuplicates: true,
    });
    return { count: result.count };
  }

  private toDomain(row: MateriasXAlumnoRow): MateriasXAlumnoXCursoXCiclo {
    return MateriasXAlumnoXCursoXCiclo.reconstruct({
      id: row.id,
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      studentId: row.studentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
