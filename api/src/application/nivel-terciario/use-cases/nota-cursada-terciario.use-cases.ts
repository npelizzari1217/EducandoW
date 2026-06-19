import { Injectable } from '@nestjs/common';
import {
  ok,
  err,
  Result,
  NotFoundError,
  ForbiddenError,
  NotaCursadaTerciario,
  NotaCursadaTerciarioRepository,
  SlotCursadaTerciario,
  CondicionCursada,
  EstadoInscripcion,
  InscripcionRepository,
  RecuperatorioPolicy,
  CondicionCursadaInvalidaError,
  DomainError,
} from '@educandow/domain';
import type { TerciarioAuthorizerPort } from '@educandow/domain';

// ── Input types ────────────────────────────────────────────────────────────────

export interface CreateSlotInput {
  slot: string;
  nota?: number;
  condicion: string;
  fecha?: string;
}

export interface UpdateSlotInput {
  nota?: number;
  condicion?: string;
  fecha?: string;
}

export interface ConfirmarNotaCursadaInput {
  condicion: string;
  notaCursada?: number;
}

/** Condiciones válidas para confirmar cursada */
const CONDICIONES_CONFIRMACION = new Set(['REGULAR', 'PROMOCIONAL', 'LIBRE']);

// ── Use cases ──────────────────────────────────────────────────────────────────

@Injectable()
export class CreateNotaCursadaSlotUC {
  constructor(
    private readonly repo: NotaCursadaTerciarioRepository,
    private readonly authz: TerciarioAuthorizerPort,
  ) {}

  async execute(
    userId: string,
    userRoles: string[],
    inscripcionMateriaId: string,
    input: CreateSlotInput,
  ): Promise<Result<NotaCursadaTerciario, DomainError>> {
    // Door 3: ownership check (SPEC-5.1)
    if (!(await this.authz.canWriteGrades(userId, userRoles, inscripcionMateriaId))) {
      return err(new ForbiddenError('No estás asignado a esta materia'));
    }

    const existing = await this.repo.findByInscripcion(inscripcionMateriaId);
    const slotNuevo = SlotCursadaTerciario.create(input.slot);

    const policyResult = RecuperatorioPolicy.check(slotNuevo, inscripcionMateriaId, existing);
    if (policyResult.isErr()) return err(policyResult.unwrapErr());

    const nota = NotaCursadaTerciario.create({
      inscripcionMateriaId,
      slot: slotNuevo,
      nota: input.nota,
      condicion: CondicionCursada.create(input.condicion),
      fecha: input.fecha,
    });

    await this.repo.save(nota);
    return ok(nota);
  }
}

@Injectable()
export class UpdateNotaCursadaSlotUC {
  constructor(
    private readonly repo: NotaCursadaTerciarioRepository,
    private readonly authz: TerciarioAuthorizerPort,
  ) {}

  async execute(
    userId: string,
    userRoles: string[],
    inscripcionMateriaId: string,
    slot: string,
    input: UpdateSlotInput,
  ): Promise<Result<NotaCursadaTerciario, DomainError>> {
    // Door 3: ownership check (SPEC-5.2)
    if (!(await this.authz.canWriteGrades(userId, userRoles, inscripcionMateriaId))) {
      return err(new ForbiddenError('No estás asignado a esta materia'));
    }

    const existing = await this.repo.findSlot(inscripcionMateriaId, slot);
    if (!existing) return err(new NotFoundError('NotaCursadaTerciario', `${inscripcionMateriaId}/${slot}`));

    if (input.nota !== undefined) existing.updateNota(input.nota);
    if (input.condicion !== undefined) existing.updateCondicion(CondicionCursada.create(input.condicion));
    if (input.fecha !== undefined) existing.updateFecha(input.fecha);

    await this.repo.update(existing);
    return ok(existing);
  }
}

@Injectable()
export class ListNotaCursadaSlotsUC {
  constructor(private readonly repo: NotaCursadaTerciarioRepository) {}

  async execute(inscripcionMateriaId: string): Promise<NotaCursadaTerciario[]> {
    return this.repo.findByInscripcion(inscripcionMateriaId);
  }
}

@Injectable()
export class ConfirmarNotaCursadaUC {
  constructor(
    private readonly inscripcionRepo: InscripcionRepository,
    private readonly authz: TerciarioAuthorizerPort,
  ) {}

  async execute(
    userId: string,
    userRoles: string[],
    inscripcionMateriaId: string,
    input: ConfirmarNotaCursadaInput,
  ): Promise<Result<void, DomainError>> {
    // Door 3: ownership check (SPEC-6.1)
    if (!(await this.authz.canWriteGrades(userId, userRoles, inscripcionMateriaId))) {
      return err(new ForbiddenError('No estás asignado a esta materia'));
    }

    // Only REGULAR, PROMOCIONAL, LIBRE are valid confirmation states (ADR-1)
    if (!CONDICIONES_CONFIRMACION.has(input.condicion)) {
      return err(new CondicionCursadaInvalidaError(input.condicion));
    }

    const inscripcion = await this.inscripcionRepo.findById(inscripcionMateriaId);
    if (!inscripcion) return err(new NotFoundError('InscripcionMateria', inscripcionMateriaId));

    // Map condicion (business term) to estado (model field) — ADR-1
    inscripcion.updateEstado(EstadoInscripcion.create(input.condicion));
    if (input.notaCursada !== undefined) {
      inscripcion.updateNotas(input.notaCursada);
    }

    // Write fechaRegularidad = now() when becoming REGULAR (write-once — FR-2.1, FR-2.2)
    if (input.condicion === 'REGULAR') {
      inscripcion.setFechaRegularidad(new Date());
    }

    await this.inscripcionRepo.save(inscripcion);
    return ok(undefined);
  }
}

@Injectable()
export class ListInscripcionesDocenteUC {
  constructor(
    private readonly authz: TerciarioAuthorizerPort,
    private readonly inscripcionRepo: InscripcionRepository,
  ) {}

  async execute(
    userId: string,
    userRoles: string[],
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<Result<import('@educandow/domain').InscripcionMateria[], ForbiddenError>> {
    const scope = await this.authz.getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico);
    if (scope === null) return err(new ForbiddenError('No estás asignado a esta materia'));
    const all = await this.inscripcionRepo.listByMateria(materiaCarreraId, anioAcademico);
    return ok(scope === 'all' ? all : all.filter(i => scope.includes(i.studentId)));
  }
}
