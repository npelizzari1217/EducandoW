import { Injectable } from '@nestjs/common';
import {
  RegimenAcademicoRepository,
  RegimenAcademico,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface RegimenAcademicoRow {
  id: string;
  cursoId: string;
  subjectId: string;
  promocionDirecta: boolean;
  requiereExamenFinal: boolean;
  notaMinimaAprobacion: number;
}

@Injectable()
export class PrismaRegimenAcademicoRepository implements RegimenAcademicoRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async findById(id: string): Promise<RegimenAcademico | null> {
    const record = await this.client.regimenAcademico.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByCursoAndSubject(cursoId: string, subjectId: string): Promise<RegimenAcademico | null> {
    const record = await this.client.regimenAcademico.findUnique({
      where: { cursoId_subjectId: { cursoId, subjectId } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByCurso(cursoId: string): Promise<RegimenAcademico[]> {
    const records = await this.client.regimenAcademico.findMany({
      where: { cursoId },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(regimen: RegimenAcademico): Promise<void> {
    await this.client.regimenAcademico.upsert({
      where: { id: regimen.id.get() },
      create: {
        id: regimen.id.get(),
        cursoId: regimen.cursoId,
        subjectId: regimen.subjectId,
        promocionDirecta: regimen.promocionDirecta,
        requiereExamenFinal: regimen.requiereExamenFinal,
        notaMinimaAprobacion: regimen.notaMinimaAprobacion,
      },
      update: {
        promocionDirecta: regimen.promocionDirecta,
        requiereExamenFinal: regimen.requiereExamenFinal,
        notaMinimaAprobacion: regimen.notaMinimaAprobacion,
      },
    });
  }

  private toDomain(record: RegimenAcademicoRow): RegimenAcademico {
    return RegimenAcademico.reconstruct({
      id: Id.reconstruct(record.id),
      cursoId: record.cursoId,
      subjectId: record.subjectId,
      promocionDirecta: record.promocionDirecta,
      requiereExamenFinal: record.requiereExamenFinal,
      notaMinimaAprobacion: record.notaMinimaAprobacion,
    });
  }
}
