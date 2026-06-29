import { Injectable } from '@nestjs/common';
import {
  AlumnosXCursoXCiclo,
  AlumnosXCursoXCicloRepository,
  type AlumnoCursoCicloEnriched,
  type StudentMembershipEnriched,
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
   * Returns enrollments enriched with studentId + studentName + printable gate (SDD-2).
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
      select: { id: true, firstName: true, lastName: true, fechaDePase: true },
    });
    const studentMap = new Map<string, { firstName: string; lastName: string; fechaDePase: Date | null }>(
      students.map((s: { id: string; firstName: string; lastName: string; fechaDePase: Date | null }) => [
        s.id,
        { firstName: s.firstName, lastName: s.lastName, fechaDePase: s.fechaDePase },
      ]),
    );
    // Orden por Apellido + Nombre (es-AR, case/acento-insensible)
    const sortKey = (studentId: string): string => {
      const s = studentMap.get(studentId);
      return s ? `${s.lastName} ${s.firstName}`.trim().toLowerCase() : '';
    };

    return rows
      .map((a: { id: string; studentId: string; printable: boolean }) => {
        const s = studentMap.get(a.studentId);
        return {
          id: a.id,
          studentId: a.studentId,
          studentName: s ? `${s.firstName} ${s.lastName}`.trim() : a.studentId,
          printable: a.printable,
          fechaDePase: s?.fechaDePase ? s.fechaDePase.toISOString() : null,
        };
      })
      .sort((x, y) => sortKey(x.studentId).localeCompare(sortKey(y.studentId), 'es'));
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

  /**
   * Toggle `printable` for a single row by bridge-row id (SDD-2, REQ-TOG-1).
   * IDOR is enforced in the use-case layer (TogglePrintableUseCase).
   * Returns the updated domain entity.
   */
  async setPrintable(id: string, value: boolean): Promise<AlumnosXCursoXCiclo> {
    const row = await this.client.alumnosXCursoXCiclo.update({
      where: { id },
      data: { printable: value, updatedAt: new Date() },
    });
    return this.toDomain(row);
  }

  /**
   * Bulk-set `printable` for ALL rows of a CourseCycle (SDD-2, REQ-TOG-2/3).
   * Implements "Todos" (value=true) and "Ninguno" (value=false).
   * Tenant isolation: TenantContext.getClient() already scopes to the tenant DB;
   * the WHERE clause further restricts to the given courseCycleId.
   */
  async setPrintableBulk(courseCycleId: string, value: boolean): Promise<void> {
    await this.client.alumnosXCursoXCiclo.updateMany({
      where: { courseCycleId },
      data: { printable: value, updatedAt: new Date() },
    });
  }

  /**
   * Returns all AlumnosXCursoXCiclo rows for a student enriched with CourseCycle display info.
   * SDD-2 R16/R17: replaces GET /enrollments?studentId in the web StudentLegajo and boletín dropdown.
   */
  async findByStudentEnriched(studentId: string): Promise<StudentMembershipEnriched[]> {
    const rows = await this.client.alumnosXCursoXCiclo.findMany({
      where: { studentId },
      include: {
        courseCycle: {
          select: {
            uuid: true,
            level: true,
            cycle: { select: { name: true } },
            course: { select: { grade: true, division: true, academicYear: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r: {
      id: string;
      courseCycleId: string;
      printable: boolean;
      createdAt: Date;
      courseCycle: {
        uuid: string;
        level: number;
        cycle: { name: string };
        course: { grade: string | null; division: string | null; academicYear: string };
      };
    }) => ({
      id: r.id,
      courseCycleId: r.courseCycleId,
      printable: r.printable,
      level: r.courseCycle.level,
      academicYear: r.courseCycle.course.academicYear,
      cycleName: r.courseCycle.cycle.name,
      grade: r.courseCycle.course.grade,
      division: r.courseCycle.course.division,
      createdAt: r.createdAt.toISOString(),
    }));
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
