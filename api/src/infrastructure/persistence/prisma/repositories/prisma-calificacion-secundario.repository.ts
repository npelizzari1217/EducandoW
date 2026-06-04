import { Injectable } from '@nestjs/common';
import {
  CalificacionSecundarioRepository,
  CalificacionSecundario,
  CondicionAlumno,
  Trimestre,
  Id,
} from '@educandow/domain';
import type {
  PrismaClient as TenantPrismaClient,
  CalificacionSecundario as PrismaCalificacionSecundario,
} from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaCalificacionSecundarioRepository
  implements CalificacionSecundarioRepository
{
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c)
      throw new Error(
        'TenantContext: no tenant client available for this request',
      );
    return c;
  }

  async findById(id: string): Promise<CalificacionSecundario | null> {
    const record = await this.client.calificacionSecundario.findUnique({
      where: { id },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByCurso(
    cursoId: string,
    trimestre?: string,
  ): Promise<CalificacionSecundario[]> {
    const records = await this.client.calificacionSecundario.findMany({
      where: {
        cursoId,
        ...(trimestre ? { trimestre } : {}),
      },
      orderBy: [{ studentId: 'asc' }, { trimestre: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByStudent(
    studentId: string,
  ): Promise<CalificacionSecundario[]> {
    const records = await this.client.calificacionSecundario.findMany({
      where: { studentId },
      orderBy: [{ trimestre: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async findPendingExams(
    turno: 'DICIEMBRE' | 'FEBRERO',
    academicYear: string,
  ): Promise<CalificacionSecundario[]> {
    const records = await this.client.calificacionSecundario.findMany({
      where: {
        condicion: { in: ['PREVIA', 'LIBRE'] },
        ...(turno === 'DICIEMBRE'
          ? { notaDiciembre: null }
          : { notaFebrero: null }),
        curso: {
          academicYear,
        },
      },
      orderBy: [{ studentId: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(calificacion: CalificacionSecundario): Promise<void> {
    await this.client.calificacionSecundario.upsert({
      where: { id: calificacion.id.get() },
      create: {
        id: calificacion.id.get(),
        studentId: calificacion.studentId,
        cursoId: calificacion.cursoId,
        subjectId: calificacion.subjectId,
        trimestre: calificacion.trimestre.value,
        nota: calificacion.nota,
        condicion: calificacion.condicion.get(),
        notaDiciembre: calificacion.notaDiciembre,
        notaFebrero: calificacion.notaFebrero,
      },
      update: {
        nota: calificacion.nota,
        condicion: calificacion.condicion.get(),
        notaDiciembre: calificacion.notaDiciembre,
        notaFebrero: calificacion.notaFebrero,
      },
    });
  }

  private toDomain(
    record: PrismaCalificacionSecundario,
  ): CalificacionSecundario {
    const trimestreResult = Trimestre.create(record.trimestre);
    if (trimestreResult.isErr()) {
      throw new Error(
        `Invalid CalificacionSecundario data in DB: id=${record.id}`,
      );
    }

    const condicion = CondicionAlumno.reconstruct(
      record.condicion as 'APROBADO' | 'PREVIA' | 'LIBRE',
    );

    return CalificacionSecundario.reconstruct({
      id: Id.reconstruct(record.id),
      studentId: record.studentId,
      cursoId: record.cursoId,
      subjectId: record.subjectId,
      trimestre: trimestreResult.unwrap(),
      nota: record.nota,
      condicion,
      notaDiciembre: record.notaDiciembre,
      notaFebrero: record.notaFebrero,
    });
  }
}
