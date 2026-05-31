import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError,
  Titulo, EstadoTitulo, TituloRepository,
} from '@educandow/domain';

export interface CreateTituloInput {
  studentId: string;
  carreraId: string;
  fechaEgreso?: string;
  estado?: string;
  nroRegistro?: string;
}

export interface UpdateTituloEstadoInput {
  estado: string;
  nroRegistro?: string;
  fechaEmision?: string;
  fechaEgreso?: string;
}

@Injectable()
export class CreateTituloUC {
  constructor(private readonly repo: TituloRepository) {}

  async execute(input: CreateTituloInput): Promise<Result<Titulo, ValidationError>> {
    let estadoVO: EstadoTitulo;
    try {
      estadoVO = EstadoTitulo.create(input.estado ?? 'EN_TRAMITE');
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    const titulo = Titulo.create({
      studentId: input.studentId,
      carreraId: input.carreraId,
      fechaEgreso: input.fechaEgreso ? new Date(input.fechaEgreso) : undefined,
      estado: estadoVO,
      nroRegistro: input.nroRegistro,
    });

    await this.repo.save(titulo);
    return ok(titulo);
  }
}

@Injectable()
export class ListTitulosUC {
  constructor(private readonly repo: TituloRepository) {}

  async execute(studentId?: string): Promise<Titulo[]> {
    if (studentId) return this.repo.findByStudent(studentId);
    return this.repo.findAll();
  }
}

@Injectable()
export class GetTituloUC {
  constructor(private readonly repo: TituloRepository) {}

  async execute(id: string): Promise<Titulo | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateTituloEstadoUC {
  constructor(private readonly repo: TituloRepository) {}

  async execute(id: string, input: UpdateTituloEstadoInput): Promise<Result<Titulo, NotFoundError | ValidationError>> {
    const titulo = await this.repo.findById(id);
    if (!titulo) return err(new NotFoundError('Titulo', id));

    let estadoVO: EstadoTitulo;
    try {
      estadoVO = EstadoTitulo.create(input.estado);
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    titulo.updateEstado(estadoVO);

    await this.repo.save(titulo);
    return ok(titulo);
  }
}
