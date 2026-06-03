import { Injectable } from '@nestjs/common';
import { InscripcionRepository, InscripcionMateria, EstadoInscripcion, Id, CorrelativaRequerida } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface InscripcionRow {
  id: string;
  studentId: string;
  materiaCarreraId: string;
  cuatrimestre: string;
  anioAcademico: string;
  estado: string;
  notaCursada?: number | null;
  notaFinal?: number | null;
}

interface CorrelatividadRow {
  id: string;
  materiaId: string;
  correlativaId: string;
  tipo: string;
}

@Injectable()
export class PrismaInscripcionMateriaRepository implements InscripcionRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<InscripcionMateria | null> {
    const r = await this.client.inscripcionMateria.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByStudent(studentId: string): Promise<InscripcionMateria[]> {
    const rs = await this.client.inscripcionMateria.findMany({
      where: { studentId },
      orderBy: { anioAcademico: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findByMateriaCarrera(materiaCarreraId: string): Promise<InscripcionMateria[]> {
    const rs = await this.client.inscripcionMateria.findMany({
      where: { materiaCarreraId },
      orderBy: { anioAcademico: 'desc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async findCorrelativas(materiaCarreraId: string): Promise<CorrelativaRequerida[]> {
    const rs = await this.client.correlatividad.findMany({
      where: { materiaId: materiaCarreraId },
    });
    return (rs as CorrelatividadRow[]).map((r) => ({
      id: r.id,
      materiaId: r.materiaId,
      correlativaId: r.correlativaId,
      tipo: r.tipo,
    }));
  }

  async findAprobadas(studentId: string): Promise<string[]> {
    const rs = await this.client.inscripcionMateria.findMany({
      where: { studentId, estado: 'APROBADO' },
      select: { materiaCarreraId: true },
    });
    return rs.map((r) => r.materiaCarreraId);
  }

  async findRegulares(studentId: string): Promise<string[]> {
    const rs = await this.client.inscripcionMateria.findMany({
      where: { studentId, estado: { in: ['REGULAR', 'APROBADO'] } },
      select: { materiaCarreraId: true },
    });
    return rs.map((r) => r.materiaCarreraId);
  }

  async save(inscripcion: InscripcionMateria): Promise<void> {
    await this.client.inscripcionMateria.upsert({
      where: { id: inscripcion.id.get() },
      create: {
        id: inscripcion.id.get(),
        studentId: inscripcion.studentId,
        materiaCarreraId: inscripcion.materiaCarreraId,
        cuatrimestre: inscripcion.cuatrimestre,
        anioAcademico: inscripcion.anioAcademico,
        estado: inscripcion.estado.get(),
        notaCursada: inscripcion.notaCursada,
        notaFinal: inscripcion.notaFinal,
      },
      update: {
        estado: inscripcion.estado.get(),
        notaCursada: inscripcion.notaCursada,
        notaFinal: inscripcion.notaFinal,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.inscripcionMateria.delete({ where: { id } });
  }

  private toDomain(r: InscripcionRow): InscripcionMateria {
    return InscripcionMateria.reconstruct({
      id: Id.reconstruct(r.id),
      studentId: r.studentId,
      materiaCarreraId: r.materiaCarreraId,
      cuatrimestre: r.cuatrimestre,
      anioAcademico: r.anioAcademico,
      estado: EstadoInscripcion.create(r.estado),
      notaCursada: r.notaCursada ?? undefined,
      notaFinal: r.notaFinal ?? undefined,
    });
  }
}
