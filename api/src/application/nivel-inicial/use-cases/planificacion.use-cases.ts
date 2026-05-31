import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, Planificacion } from '@educandow/domain';
import type { PlanificacionRepository, PlanificacionFilters } from '@educandow/domain';

export interface SecuenciaInput {
  nombre: string;
  area: string;
  actividades: string[];
  recursos: string[];
}

export interface CreatePlanificacionInput {
  salaId: string;
  semana: number;
  academicYear: string;
  secuencias?: SecuenciaInput[];
}

export interface UpdatePlanificacionInput {
  semana?: number;
  academicYear?: string;
  secuencias?: SecuenciaInput[];
}

@Injectable()
export class CreatePlanificacionUseCase {
  constructor(private readonly repo: PlanificacionRepository) {}

  async execute(input: CreatePlanificacionInput): Promise<Result<Planificacion, ValidationError>> {
    const result = Planificacion.create({
      salaId: input.salaId,
      semana: input.semana,
      academicYear: input.academicYear,
      secuencias: input.secuencias?.map((s) => ({
        id: '',
        planificacionId: '',
        nombre: s.nombre,
        area: s.area,
        actividades: s.actividades,
        recursos: s.recursos,
      })),
    });
    if (result.isErr()) return err(result.unwrapErr());

    const planificacion = result.unwrap();
    await this.repo.save(planificacion);
    return ok(planificacion);
  }
}

@Injectable()
export class ListPlanificacionesUseCase {
  constructor(private readonly repo: PlanificacionRepository) {}

  async execute(filters?: PlanificacionFilters): Promise<Result<Planificacion[], never>> {
    const planificaciones = await this.repo.findAll(filters);
    return ok(planificaciones);
  }
}

@Injectable()
export class UpdatePlanificacionUseCase {
  constructor(private readonly repo: PlanificacionRepository) {}

  async execute(id: string, input: UpdatePlanificacionInput): Promise<Result<Planificacion, ValidationError | NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) return err(new NotFoundError('Planificacion', id));

    const secuencias = input.secuencias
      ? input.secuencias.map((s) => ({
          id: '',
          planificacionId: id,
          nombre: s.nombre,
          area: s.area,
          actividades: s.actividades,
          recursos: s.recursos,
        }))
      : existing.secuencias;

    const result = Planificacion.create({
      salaId: existing.salaId,
      semana: input.semana ?? existing.semana,
      academicYear: input.academicYear ?? existing.academicYear,
      secuencias,
    });

    if (result.isErr()) return err(result.unwrapErr());

    const updated = Planificacion.reconstruct({
      id: existing.id,
      salaId: existing.salaId,
      semana: result.unwrap().semana,
      academicYear: result.unwrap().academicYear,
      active: existing.active,
      deletedAt: existing.deletedAt,
      secuencias: result.unwrap().secuencias,
    });

    await this.repo.save(updated);
    return ok(updated);
  }
}
