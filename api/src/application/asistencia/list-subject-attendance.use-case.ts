/**
 * ListSubjectAttendanceUseCase — application use-case (SDD-4 PR-2).
 *
 * Returns per-materia monthly attendance rows for a MateriaXCursoXCiclo + month.
 * Supports an optional grupoId filter (ADR-2):
 *   - grupoId provided → resolve that group's studentIds, filter rows to those students
 *   - grupoId absent  → return all rows for the materia (no-group fallback, R-23)
 *
 * Authorization:
 *   D3 — full scope
 *   Door 2 — teacher owns at least one group for this materia
 *
 * Spec: R-22, R-23, R-24, R-32.
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ok,
  err,
} from '@educandow/domain';
import type {
  AsistenciaMateriaRepository,
  GrupoRepository,
  AlumnosXGrupoRepository,
  DocenteXCicloRepository,
  EnrichedMateriaAttendance,
  Result,
} from '@educandow/domain';
import { ForbiddenError } from '../shared/errors/forbidden-error';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface ListSubjectAttendanceInput {
  materiaXCursoXCicloId: string;
  year: number;
  month: number;
  /** Optional group filter: when provided, only returns rows for students in that group. */
  grupoId?: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class ListSubjectAttendanceUseCase {
  constructor(
    private readonly materiaAsistRepo: AsistenciaMateriaRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
  ) {}

  async execute(
    input: ListSubjectAttendanceInput,
  ): Promise<Result<EnrichedMateriaAttendance[], ForbiddenError>> {
    const { materiaXCursoXCicloId, year, month, grupoId, userId, userRoles } = input;

    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      const check = await this.checkDoor2(materiaXCursoXCicloId, userId);
      if (check.isErr()) return err(check.unwrapErr());
    }

    // Apply group filter when grupoId is provided (ADR-2, R-22/R-23)
    let studentIds: string[] | undefined;
    if (grupoId) {
      studentIds = await this.alumnosXGrupoRepo.findStudentIdsByGrupoIds([grupoId]);
    }

    const rows = await this.materiaAsistRepo.findByScopeAndMonthEnriched(materiaXCursoXCicloId, year, month, studentIds);
    return ok(rows);
  }

  private async checkDoor2(materiaXCursoXCicloId: string, userId: string): Promise<Result<void, ForbiddenError>> {
    const client = TenantContext.getClient();
    if (!client) {
      return err(new ForbiddenError('Tenant context unavailable'));
    }

    // Resolve materia → CC → cycleId
    const materia = await client.materiaXCursoXCiclo.findUnique({
      where: { id: materiaXCursoXCicloId },
      select: { courseCycleId: true },
    });
    if (!materia) {
      return err(new ForbiddenError('MateriaXCursoXCiclo not found — authorization failed'));
    }

    const cc = await client.courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      return err(new ForbiddenError('CourseCycle not found — authorization failed'));
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      return err(new ForbiddenError('User is not a DocenteXCiclo in this cycle'));
    }

    const teacherGroups = await this.grupoRepo.findGroupsForDocente(docente.id, materiaXCursoXCicloId);
    if (teacherGroups.length === 0) {
      return err(new ForbiddenError('User has no group assignment for this materia'));
    }

    return ok(undefined);
  }
}
