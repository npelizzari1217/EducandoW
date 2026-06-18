import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError,
  ActaExamen, CondicionExamen, ActaExamenRepository,
  InscripcionRepository, EstadoInscripcion, IntentoFinal,
  NotaCursadaTerciarioRepository,
  FinalEligibilityPolicy,
  DomainError,
  CursadaNoConfirmadaError,
} from '@educandow/domain';
import type { TenantTransactionRunner } from '../../shared/ports/tenant-transaction-runner';

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

export interface RegistrarNotaFinalInput {
  studentId: string;
  nota: number;
  condicion: string;
}

export interface RegistrarPromocionalInput {
  notaFinal: number;
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

/**
 * RegistrarNotaFinalUC — Terciario use case for recording a final exam grade.
 * Applies FinalEligibilityPolicy guards (design §4.2, §5).
 * Atomically transitions student to LIBRE on 3rd failure via TenantTransactionRunner (design §6.5).
 */
@Injectable()
export class RegistrarNotaFinalUC {
  constructor(
    private readonly repo: ActaExamenRepository,
    private readonly inscripcionRepo: InscripcionRepository,
    private readonly notaCursadaRepo: NotaCursadaTerciarioRepository,
    private readonly txRunner: TenantTransactionRunner,
  ) {}

  async execute(
    actaId: string,
    input: RegistrarNotaFinalInput,
  ): Promise<Result<{ libreTransicion: boolean }, DomainError>> {
    // Step 1: load acta
    const acta = await this.repo.findById(actaId);
    if (!acta) return err(new NotFoundError('ActaExamen', actaId));

    // Step 2: load inscripcion
    const inscripcion = await this.inscripcionRepo.findByStudentAndMateria(
      input.studentId,
      acta.materiaCarreraId,
    );
    if (!inscripcion) return err(new NotFoundError('InscripcionMateria', input.studentId));

    // Step 3: count previous attempts (DESAPROBADO + AUSENTE)
    const intentosPrevios = await this.repo.countIntentosFinal(input.studentId, acta.materiaCarreraId);

    // Step 4: load TP slot
    const tpSlot = await this.notaCursadaRepo.findSlot(inscripcion.id.get(), 'TP');

    // Step 5-6: FinalEligibilityPolicy guards
    const policyResult = FinalEligibilityPolicy.check({
      estado: inscripcion.estado,
      tpSlot,
      intentosPrevios,
    });
    if (policyResult.isErr()) return err(policyResult.unwrapErr());

    const intentoAsignado = policyResult.unwrap();

    // Step 7: create condicion
    let condicionFinal: CondicionExamen;
    try {
      condicionFinal = CondicionExamen.create(input.condicion);
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    // Step 8: check LIBRE transition
    const transicionar = FinalEligibilityPolicy.shouldTransitionToLibre(intentoAsignado, condicionFinal);

    // Step 9: persist atomically
    await this.txRunner.run(async () => {
      acta.registrarNota(input.studentId, input.nota, condicionFinal, intentoAsignado);
      await this.repo.saveNota(actaId, input.studentId, input.nota, condicionFinal.get(), intentoAsignado.get());
      if (transicionar) {
        inscripcion.updateEstado(EstadoInscripcion.create('LIBRE'));
        await this.inscripcionRepo.save(inscripcion);
      }
    });

    // Step 10: return
    return ok({ libreTransicion: transicionar });
  }
}

/**
 * RegistrarPromocionalUC — PROMOCIONAL bypass: skips ActaExamenNota creation.
 * [SUPUESTO] — requires estado=PROMOCIONAL; sets notaFinal + estado=APROBADO.
 */
@Injectable()
export class RegistrarPromocionalUC {
  constructor(private readonly inscripcionRepo: InscripcionRepository) {}

  async execute(
    inscripcionMateriaId: string,
    input: RegistrarPromocionalInput,
  ): Promise<Result<void, DomainError>> {
    // [SUPUESTO]
    const inscripcion = await this.inscripcionRepo.findById(inscripcionMateriaId);
    if (!inscripcion) return err(new NotFoundError('InscripcionMateria', inscripcionMateriaId));

    if (!inscripcion.estado.esPromocional()) {
      return err(new CursadaNoConfirmadaError());
    }

    inscripcion.updateEstado(EstadoInscripcion.create('APROBADO'));
    inscripcion.updateNotas(undefined, input.notaFinal);
    await this.inscripcionRepo.save(inscripcion);

    return ok(undefined);
  }
}
