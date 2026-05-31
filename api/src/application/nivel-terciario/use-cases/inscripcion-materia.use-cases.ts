import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError,
  InscripcionMateria, EstadoInscripcion, InscripcionRepository,
} from '@educandow/domain';

export interface CreateInscripcionInput {
  studentId: string;
  materiaCarreraId: string;
  cuatrimestre: string;
  anioAcademico: string;
}

export interface UpdateInscripcionEstadoInput {
  estado: string;
  notaCursada?: number;
  notaFinal?: number;
}

@Injectable()
export class CreateInscripcionUC {
  constructor(private readonly repo: InscripcionRepository) {}

  async execute(input: CreateInscripcionInput): Promise<Result<InscripcionMateria, ValidationError>> {
    // Validate correlativas
    const correlativas = await this.repo.findCorrelativas(input.materiaCarreraId);

    if (correlativas.length > 0) {
      const aprobadas = await this.repo.findAprobadas(input.studentId);
      const regulares = await this.repo.findRegulares(input.studentId);

      const inscripcion = InscripcionMateria.create({
        studentId: input.studentId,
        materiaCarreraId: input.materiaCarreraId,
        cuatrimestre: input.cuatrimestre,
        anioAcademico: input.anioAcademico,
        estado: EstadoInscripcion.create('INSCRIPTO'),
      });

      const validationResult = inscripcion.validarCorrelativas(
        correlativas,
        new Set(aprobadas),
        new Set([...regulares, ...aprobadas]),
      );

      if (validationResult.isErr()) return err(validationResult.unwrapErr());

      await this.repo.save(inscripcion);
      return ok(inscripcion);
    }

    const inscripcion = InscripcionMateria.create({
      studentId: input.studentId,
      materiaCarreraId: input.materiaCarreraId,
      cuatrimestre: input.cuatrimestre,
      anioAcademico: input.anioAcademico,
      estado: EstadoInscripcion.create('INSCRIPTO'),
    });

    await this.repo.save(inscripcion);
    return ok(inscripcion);
  }
}

@Injectable()
export class ListInscripcionesUC {
  constructor(private readonly repo: InscripcionRepository) {}

  async execute(studentId?: string, materiaCarreraId?: string): Promise<InscripcionMateria[]> {
    if (studentId) return this.repo.findByStudent(studentId);
    if (materiaCarreraId) return this.repo.findByMateriaCarrera(materiaCarreraId);
    return [];
  }
}

@Injectable()
export class GetInscripcionUC {
  constructor(private readonly repo: InscripcionRepository) {}

  async execute(id: string): Promise<InscripcionMateria | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateInscripcionEstadoUC {
  constructor(private readonly repo: InscripcionRepository) {}

  async execute(id: string, input: UpdateInscripcionEstadoInput): Promise<Result<InscripcionMateria, NotFoundError | ValidationError>> {
    const inscripcion = await this.repo.findById(id);
    if (!inscripcion) return err(new NotFoundError('InscripcionMateria', id));

    try {
      inscripcion.updateEstado(EstadoInscripcion.create(input.estado));
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    inscripcion.updateNotas(input.notaCursada, input.notaFinal);
    await this.repo.save(inscripcion);
    return ok(inscripcion);
  }
}
