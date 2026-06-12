/**
 * GetSubjectAbsencesUseCase — application use-case (Fase 6, F6-A3).
 *
 * Reads absences for a GrupoXCursoXMateriaXCiclo on a given date.
 *
 * Scope:
 *   - TEACHER: scoped to the group (only their assigned group's absences)
 *     → Door 2 check: must be the DocenteXCiclo of the grupo.
 *   - SECRETARIO/DIRECTOR/ADMIN/ROOT (D3): full scope for their institution.
 *     → No additional check; caller passes grupoId directly.
 *
 * For simplicity, this use-case returns all absences for the given grupoId+date.
 * The caller (controller) must ensure the grupoId is appropriate for the user's scope.
 */
import { Injectable } from '@nestjs/common';
import { resolveAccessScope, ForbiddenError } from '@educandow/domain';
import type {
  SubjectAbsenceRepository,
  GrupoRepository,
  DocenteXCicloRepository,
  AusenciaXGrupo,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface GetSubjectAbsencesInput {
  grupoId: string;
  date: Date;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class GetSubjectAbsencesUseCase {
  constructor(
    private readonly absenceRepo: SubjectAbsenceRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
  ) {}

  async execute(input: GetSubjectAbsencesInput): Promise<AusenciaXGrupo[]> {
    const scope = resolveAccessScope({ roles: input.userRoles });

    // D3: management roles get full scope — no Door 2 check
    if (!scope.isAdministrative) {
      await this.checkDoor2(input.grupoId, input.userId);
    }

    return this.absenceRepo.findByGrupoAndDate(input.grupoId, input.date);
  }

  private async checkDoor2(grupoId: string, userId: string): Promise<void> {
    const grupo = await this.grupoRepo.findById(grupoId);
    if (!grupo) {
      throw new ForbiddenError('Group not found — authorization failed');
    }

    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }

    const materia = await client.materiaXCursoXCiclo.findUnique({
      where: { id: grupo.materiaXCursoXCicloId },
      select: { courseCycleId: true },
    });
    if (!materia) {
      throw new ForbiddenError('Materia not found — authorization failed');
    }

    const cc = await client.courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    if (docente.id !== grupo.docenteXCicloId) {
      throw new ForbiddenError('User is not assigned to this group');
    }
  }
}
