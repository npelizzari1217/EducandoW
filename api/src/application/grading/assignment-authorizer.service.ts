/**
 * AssignmentAuthorizer — application service (F5-A1).
 *
 * Implements AssignmentAuthorizerPort (Fase 5). Decides whether a user may
 * write grades for a given (courseCycleId, subjectId) combination.
 *
 * Authorization model — 3 gates:
 *   Door 1 (module check): enforced at the controller/roles-guard level (GRADES:WRITE).
 *   Door 2 (management bypass, D3): SECRETARIO / DIRECTOR / ADMIN (rank >= SECRETARIO)
 *     bypass the group-assignment gate. ROOT bypasses everything.
 *   Door 3 (group assignment): for non-management teachers, resolves
 *     userId → DocenteXCiclo(cycleId of CC) → GrupoXCursoXMateriaXCiclo(materia)
 *     and checks that at least one group exists for the docente in that materia.
 *
 * Internal resolution steps (teacher path only):
 *   1. Fetch cycleId from CourseCycle via TenantContext (raw Prisma).
 *   2. findByUserAndCycle(userId, cycleId) → DocenteXCiclo.
 *   3. findFirst MateriaXCursoXCiclo for (courseCycleId, subjectId).
 *   4. findGroupsForDocente(docenteXCicloId, materiaXCursoXCicloId).
 *   → groups.length > 0 means the teacher IS assigned.
 */
import { Injectable } from '@nestjs/common';
import { resolveAccessScope } from '@educandow/domain';
import type { DocenteXCicloRepository, GrupoRepository, AssignmentAuthorizerPort } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

@Injectable()
export class AssignmentAuthorizer implements AssignmentAuthorizerPort {
  constructor(
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly grupoRepo: GrupoRepository,
  ) {}

  async canWriteGrades(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
    subjectId: string,
  ): Promise<boolean> {
    // ── Door 2: management bypass (D3) ───────────────────────────────────────
    const scope = resolveAccessScope({ roles: userRoles });
    if (scope.isAdministrative) {
      return true;
    }

    // ── Door 3: teacher group-assignment check ───────────────────────────────
    const client = TenantContext.getClient();
    if (!client) return false;

    // Step 1: Resolve cycleId from CourseCycle
    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) return false;

    // Step 2: Find DocenteXCiclo for (userId, cycleId)
    const dxc = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!dxc) return false;

    // Step 3: Find MateriaXCursoXCiclo for (courseCycleId, subjectId)
    const materia = await client.materiaXCursoXCiclo.findFirst({
      where: { courseCycleId, subjectId },
      select: { id: true },
    });
    if (!materia) return false;

    // Step 4: Check group assignment
    const grupos = await this.grupoRepo.findGroupsForDocente(dxc.id, materia.id);
    return grupos.length > 0;
  }
}
