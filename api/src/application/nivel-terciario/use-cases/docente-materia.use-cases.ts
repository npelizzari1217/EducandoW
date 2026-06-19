/**
 * Admin assignment use-cases — Fase D (Terciario).
 *
 * All UCs enforce isAdministrative in the use-case (ADR-5).
 * Return Result<T, DomainError> (SPEC-8.2). No throws.
 */
import { Injectable } from '@nestjs/common';
import {
  ok,
  err,
  Result,
  ForbiddenError,
  NotFoundError,
  DocenteXMateriaCarrera,
  DocenteAlreadyAssignedError,
  AssignmentAlreadyInactiveError,
  DomainError,
  resolveAccessScope,
} from '@educandow/domain';
import type { DocenteXMateriaCarreraRepository } from '@educandow/domain';

// ── AssignDocenteMateriaUC ────────────────────────────────────────────────────

export interface AssignDocenteMateriaInput {
  userId: string;
  materiaCarreraId: string;
  anioAcademico: string;
}

@Injectable()
export class AssignDocenteMateriaUC {
  constructor(private readonly repo: DocenteXMateriaCarreraRepository) {}

  async execute(
    userRoles: string[],
    input: AssignDocenteMateriaInput,
  ): Promise<Result<DocenteXMateriaCarrera, DomainError>> {
    // Admin gate (ADR-5 / SPEC-4.1)
    if (!resolveAccessScope({ roles: userRoles }).isAdministrative) {
      return err(new ForbiddenError('Solo secretaría puede gestionar asignaciones'));
    }

    const existing = await this.repo.findAny(input.userId, input.materiaCarreraId, input.anioAcademico);

    if (existing) {
      if (existing.active) {
        return err(new DocenteAlreadyAssignedError()); // 409 (SPEC-1.B / 4.2)
      }
      // Inactive row → reactivate (ADR-2)
      existing.reactivate();
      await this.repo.save(existing);
      return ok(existing);
    }

    // No row → create
    const entity = DocenteXMateriaCarrera.create(input);
    await this.repo.save(entity);
    return ok(entity);
  }
}

// ── ListAssignmentsUC ─────────────────────────────────────────────────────────

export interface ListAssignmentsInput {
  materiaCarreraId?: string;
  userId?: string;
  anioAcademico?: string;
}

@Injectable()
export class ListAssignmentsUC {
  constructor(private readonly repo: DocenteXMateriaCarreraRepository) {}

  async execute(
    userRoles: string[],
    input: ListAssignmentsInput,
  ): Promise<Result<DocenteXMateriaCarrera[], DomainError>> {
    if (!resolveAccessScope({ roles: userRoles }).isAdministrative) {
      return err(new ForbiddenError('Solo secretaría puede ver asignaciones'));
    }

    if (input.materiaCarreraId) {
      return ok(await this.repo.listByMateria(input.materiaCarreraId, input.anioAcademico));
    }

    if (input.userId) {
      return ok(await this.repo.listByDocente(input.userId));
    }

    return ok([]);
  }
}

// ── UnassignDocenteMateriaUC ──────────────────────────────────────────────────

@Injectable()
export class UnassignDocenteMateriaUC {
  constructor(private readonly repo: DocenteXMateriaCarreraRepository) {}

  async execute(
    userRoles: string[],
    id: string,
  ): Promise<Result<DocenteXMateriaCarrera, DomainError>> {
    if (!resolveAccessScope({ roles: userRoles }).isAdministrative) {
      return err(new ForbiddenError('Solo secretaría puede gestionar asignaciones'));
    }

    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new NotFoundError('DocenteXMateriaCarrera', id)); // 404 (SPEC-4.5)
    }

    if (!entity.active) {
      return err(new AssignmentAlreadyInactiveError()); // 409 (SPEC-4.E)
    }

    entity.unassign();
    await this.repo.save(entity);
    return ok(entity);
  }
}
