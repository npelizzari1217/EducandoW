import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, InformeEvolutivo } from '@educandow/domain';
import type { InformeRepository, InformeFilters, AreaDesarrolloProps } from '@educandow/domain';

export interface CreateInformeInput {
  studentId: string;
  salaId: string;
  periodo: string;
  fecha: string;
  observacionesGenerales?: string;
  areas?: AreaDesarrolloProps[];
}

export interface UpdateInformeInput {
  periodo?: string;
  fecha?: string;
  observacionesGenerales?: string;
  areas?: AreaDesarrolloProps[];
}

@Injectable()
export class CreateInformeUseCase {
  constructor(private readonly repo: InformeRepository) {}

  async execute(input: CreateInformeInput): Promise<Result<InformeEvolutivo, ValidationError>> {
    const result = InformeEvolutivo.create({
      studentId: input.studentId,
      salaId: input.salaId,
      periodo: input.periodo,
      fecha: new Date(input.fecha),
      observacionesGenerales: input.observacionesGenerales,
      areas: input.areas,
    });

    if (result.isErr()) return err(result.unwrapErr());

    const informe = result.unwrap();
    await this.repo.save(informe);
    return ok(informe);
  }
}

@Injectable()
export class GetInformeUseCase {
  constructor(private readonly repo: InformeRepository) {}

  async execute(id: string): Promise<Result<InformeEvolutivo, NotFoundError>> {
    const informe = await this.repo.findById(id);
    if (!informe) return err(new NotFoundError('InformeEvolutivo', id));
    return ok(informe);
  }
}

@Injectable()
export class ListInformesUseCase {
  constructor(private readonly repo: InformeRepository) {}

  async execute(filters?: InformeFilters): Promise<Result<InformeEvolutivo[], never>> {
    const informes = await this.repo.findAll(filters);
    return ok(informes);
  }
}

@Injectable()
export class UpdateInformeUseCase {
  constructor(private readonly repo: InformeRepository) {}

  async execute(id: string, input: UpdateInformeInput): Promise<Result<InformeEvolutivo, ValidationError | NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) return err(new NotFoundError('InformeEvolutivo', id));

    const periodoVal = input.periodo ?? existing.periodo.get();
    const fechaVal = input.fecha ? new Date(input.fecha) : existing.fecha;
    const areasVal = input.areas ?? existing.areas;

    const result = InformeEvolutivo.create({
      studentId: existing.studentId,
      salaId: existing.salaId,
      periodo: periodoVal,
      fecha: fechaVal,
      observacionesGenerales: input.observacionesGenerales !== undefined
        ? input.observacionesGenerales
        : existing.observacionesGenerales,
      areas: areasVal,
    });

    if (result.isErr()) return err(result.unwrapErr());

    const updated = InformeEvolutivo.reconstruct({
      id: existing.id,
      studentId: existing.studentId,
      salaId: existing.salaId,
      periodo: result.unwrap().periodo,
      fecha: result.unwrap().fecha,
      observacionesGenerales: result.unwrap().observacionesGenerales,
      areas: result.unwrap().areas,
    });

    await this.repo.save(updated);
    return ok(updated);
  }
}
