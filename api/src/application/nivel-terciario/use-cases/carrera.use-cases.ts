import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError,
  Carrera, CarreraRepository,
} from '@educandow/domain';

export interface CreateCarreraInput {
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string;
}

export interface UpdateCarreraInput {
  name?: string;
  titulo?: string;
  duracion?: number;
  resolucion?: string;
}

@Injectable()
export class CreateCarreraUC {
  constructor(private readonly repo: CarreraRepository) {}

  async execute(input: CreateCarreraInput): Promise<Result<Carrera, ValidationError>> {
    const carrera = Carrera.create({
      name: input.name,
      titulo: input.titulo,
      duracion: input.duracion,
      resolucion: input.resolucion,
    });
    await this.repo.save(carrera);
    return ok(carrera);
  }
}

@Injectable()
export class ListCarrerasUC {
  constructor(private readonly repo: CarreraRepository) {}

  async execute(): Promise<Carrera[]> {
    return this.repo.findAll();
  }
}

@Injectable()
export class GetCarreraUC {
  constructor(private readonly repo: CarreraRepository) {}

  async execute(id: string): Promise<Carrera | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateCarreraUC {
  constructor(private readonly repo: CarreraRepository) {}

  async execute(id: string, input: UpdateCarreraInput): Promise<Result<Carrera, NotFoundError>> {
    const carrera = await this.repo.findById(id);
    if (!carrera) return err(new NotFoundError('Carrera', id));
    carrera.update(input);
    await this.repo.save(carrera);
    return ok(carrera);
  }
}

@Injectable()
export class DeleteCarreraUC {
  constructor(private readonly repo: CarreraRepository) {}

  async execute(id: string): Promise<void> {
    const carrera = await this.repo.findById(id);
    if (!carrera) throw new NotFoundError('Carrera', id);
    carrera.softDelete();
    await this.repo.save(carrera);
  }
}
