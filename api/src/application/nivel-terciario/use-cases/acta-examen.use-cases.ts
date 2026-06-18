import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError,
  ActaExamen, CondicionExamen, ActaExamenRepository,
  InscripcionRepository, EstadoInscripcion, IntentoFinal,
} from '@educandow/domain';

export interface CreateActaExamenInput {
  materiaCarreraId: string;
  fecha: string;
  presidenteId: string;
  vocales: string[];
  libro?: string;
  folio?: string;
}

export interface RegistrarNotaInput {
  studentId: string;
  nota: number;
  condicion: string;
}

@Injectable()
export class CreateActaExamenUC {
  constructor(private readonly repo: ActaExamenRepository) {}

  async execute(input: CreateActaExamenInput): Promise<Result<ActaExamen, ValidationError>> {
    const acta = ActaExamen.create({
      materiaCarreraId: input.materiaCarreraId,
      fecha: new Date(input.fecha),
      presidenteId: input.presidenteId,
      vocales: input.vocales,
      libro: input.libro,
      folio: input.folio,
    });
    await this.repo.save(acta);
    return ok(acta);
  }
}

@Injectable()
export class ListActasExamenUC {
  constructor(private readonly repo: ActaExamenRepository) {}

  async execute(materiaCarreraId?: string): Promise<ActaExamen[]> {
    if (materiaCarreraId) return this.repo.findByMateriaCarrera(materiaCarreraId);
    return this.repo.findAll();
  }
}

@Injectable()
export class GetActaExamenUC {
  constructor(private readonly repo: ActaExamenRepository) {}

  async execute(id: string): Promise<ActaExamen | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class RegistrarNotaUC {
  constructor(
    private readonly repo: ActaExamenRepository,
    private readonly inscripcionRepo: InscripcionRepository,
  ) {}

  async execute(actaId: string, input: RegistrarNotaInput): Promise<Result<void, NotFoundError | ValidationError>> {
    const acta = await this.repo.findById(actaId);
    if (!acta) return err(new NotFoundError('ActaExamen', actaId));

    let condicion: CondicionExamen;
    try {
      condicion = CondicionExamen.create(input.condicion);
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    // Backward compat: existing RegistrarNotaUC defaults to intento=1 (backfill convention)
    acta.registrarNota(input.studentId, input.nota, condicion, IntentoFinal.create(1));
    await this.repo.saveNota(actaId, input.studentId, input.nota, condicion.get(), 1);

    // Spec: when condicion = APROBADO, update InscripcionMateria.estado to APROBADO
    if (condicion.get() === 'APROBADO') {
      const inscripcion = await this.inscripcionRepo.findByStudentAndMateria(
        input.studentId,
        acta.materiaCarreraId,
      );
      if (!inscripcion) {
        return err(new ValidationError('Inscripción no encontrada para el estudiante y materia indicados'));
      }
      inscripcion.updateEstado(EstadoInscripcion.create('APROBADO'));
      await this.inscripcionRepo.save(inscripcion);
    }

    return ok(undefined);
  }
}
