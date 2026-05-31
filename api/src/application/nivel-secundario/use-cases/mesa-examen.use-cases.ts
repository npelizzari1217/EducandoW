import { Injectable } from '@nestjs/common';
import {
  MesaExamen,
  MesaExamenInscripcionProps,
  MesaExamenRepository,
  TurnoExamen,
  Result,
  ok,
  err,
  ValidationError,
  NotFoundError,
} from '@educandow/domain';

export interface CreateMesaExamenInput {
  subjectId: string;
  fecha: Date;
  turno: string;
  presidenteId: string;
}

export interface InscribirAlumnoInput {
  studentId: string;
}

@Injectable()
export class CreateMesaExamenUseCase {
  constructor(private readonly repo: MesaExamenRepository) {}

  async execute(input: CreateMesaExamenInput): Promise<Result<MesaExamen, ValidationError>> {
    const turno = TurnoExamen.create(input.turno);
    if (!turno) {
      return err(new ValidationError(`Turno inválido: ${input.turno}. Valores permitidos: DICIEMBRE, FEBRERO`));
    }

    const mesa = MesaExamen.create({
      subjectId: input.subjectId,
      fecha: input.fecha,
      turno,
      presidenteId: input.presidenteId,
    });

    await this.repo.save(mesa);
    return ok(mesa);
  }
}

@Injectable()
export class ListMesasExamenUseCase {
  constructor(private readonly repo: MesaExamenRepository) {}

  async execute(subjectId?: string): Promise<MesaExamen[]> {
    return this.repo.findAll(subjectId);
  }
}

@Injectable()
export class GetMesaExamenUseCase {
  constructor(private readonly repo: MesaExamenRepository) {}

  async execute(id: string): Promise<Result<MesaExamen, NotFoundError>> {
    const mesa = await this.repo.findById(id);
    if (!mesa) return err(new NotFoundError('MesaExamen', id));
    return ok(mesa);
  }
}

@Injectable()
export class InscribirAlumnoUseCase {
  constructor(private readonly repo: MesaExamenRepository) {}

  async execute(mesaId: string, input: InscribirAlumnoInput): Promise<Result<void, ValidationError | NotFoundError>> {
    const mesa = await this.repo.findById(mesaId);
    if (!mesa) return err(new NotFoundError('MesaExamen', mesaId));

    const alreadyInscripto = mesa.inscripciones.some(
      (i) => i.studentId === input.studentId,
    );
    if (alreadyInscripto) {
      return err(new ValidationError('El alumno ya está inscripto en esta mesa de examen'));
    }

    await this.repo.saveInscripcion(mesaId, input.studentId);
    return ok(undefined);
  }
}

@Injectable()
export class ListInscripcionesUseCase {
  constructor(private readonly repo: MesaExamenRepository) {}

  async execute(mesaId: string): Promise<Result<MesaExamenInscripcionProps[], NotFoundError>> {
    const mesa = await this.repo.findById(mesaId);
    if (!mesa) return err(new NotFoundError('MesaExamen', mesaId));
    return ok(mesa.inscripciones);
  }
}
