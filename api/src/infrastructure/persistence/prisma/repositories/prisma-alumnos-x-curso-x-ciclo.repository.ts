import { Injectable } from '@nestjs/common';
import {
  AlumnosXCursoXCiclo,
  AlumnosXCursoXCicloRepository,
  type AlumnoCursoCicloEnriched,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

type AlumnosXCursoXCicloRow = {
  id: string;
  courseCycleId: string;
  studentId: string;
  printable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaAlumnosXCursoXCicloRepository — tenant-scoped persistence (T-14, SDD-1).
 *
 * Manages the authoritative universe of students enrolled in a CourseCycle.
 * Both FK constraints use onDelete: Restrict (ADR #1243) — the DB prevents
 * deletion of a CourseCycle or Student that still has enrollment rows.
 *
 * Mirrors PrismaAlumnosXMateriaRepository exactly.
 */
@Injectable()
export class PrismaAlumnosXCursoXCicloRepository implements AlumnosXCursoXCicloRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findByCourseCycle(courseCycleId: string): Promise<AlumnosXCursoXCiclo[]> {
    const rows = await this.client.alumnosXCursoXCiclo.findMany({
      where: { courseCycleId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<AlumnosXCursoXCiclo | null> {
    const row = await this.client.alumnosXCursoXCiclo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Add a student to a CourseCycle. Idempotent via @@unique([courseCycleId, studentId]).
   * If the pair already exists, returns the existing record without error.
   */
  async addStudent(courseCycleId: string, studentId: string): Promise<AlumnosXCursoXCiclo> {
    const now = new Date();
    const row = await this.client.alumnosXCursoXCiclo.upsert({
      where: {
        courseCycleId_studentId: { courseCycleId, studentId },
      },
      create: { courseCycleId, studentId, printable: false, createdAt: now, updatedAt: now },
      update: { updatedAt: now },
    });
    return this.toDomain(row);
  }

  async isMember(courseCycleId: string, studentId: string): Promise<boolean> {
    const count = await this.client.alumnosXCursoXCiclo.count({
      where: { courseCycleId, studentId },
    });
    return count > 0;
  }

  /**
   * Returns enrollments enriched with studentId + studentName.
   * Resolution: AlumnosXCursoXCiclo.studentId → Student firstName + lastName.
   * Throws if no tenant client is available (surfaces the error instead of silently returning []).
   */
  async findByCourseCycleEnriched(courseCycleId: string): Promise<AlumnoCursoCicloEnriched[]> {
    const rows = await this.client.alumnosXCursoXCiclo.findMany({
      where: { courseCycleId },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) return [];

    const studentIds = [...new Set(rows.map((r: { studentId: string }) => r.studentId))];
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

    return rows.map((a: { id: string; studentId: string }) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: studentNameMap.get(a.studentId) ?? a.studentId,
    }));
  }

  /**
   * Remove a student enrollment by bridge-row id, scoped to the given courseCycleId.
   * Throws NotFoundError if the row does not exist or belongs to a different cycle (IDOR).
   */
  async remove(courseCycleId: string, id: string): Promise<void> {
    const existing = await this.client.alumnosXCursoXCiclo.findUnique({ where: { id } });
    if (!existing || existing.courseCycleId !== courseCycleId) {
      throw new NotFoundError('AlumnosXCursoXCiclo', id);
    }
    await this.client.alumnosXCursoXCiclo.delete({ where: { id } });
  }

  private toDomain(row: AlumnosXCursoXCicloRow): AlumnosXCursoXCiclo {
    return AlumnosXCursoXCiclo.reconstruct({
      id: row.id,
      courseCycleId: row.courseCycleId,
      studentId: row.studentId,
      printable: row.printable,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
