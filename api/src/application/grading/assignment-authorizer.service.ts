/**
 * AssignmentAuthorizer — application service (F5-A1).
 *
 * Implements AssignmentAuthorizerPort (Fase 5). Decides whether a user may
 * write grades for a given (courseCycleId, subjectId) combination, or read
 * grade data for an entire CourseCycle.
 *
 * Authorization model — 3 gates:
 *   Door 1 (module check): enforced at the controller/roles-guard level (GRADES:WRITE).
 *   Door 2 (management bypass, D3): SECRETARIO / DIRECTOR / ADMIN (rank >= SECRETARIO)
 *     bypass the group-assignment gate. ROOT bypasses everything.
 *   Door 3 (group assignment): for non-management teachers, resolves
 *     userId → DocenteXCiclo(cycleId of CC) → GrupoXCursoXMateriaXCiclo(materia)
 *     and checks that at least one group exists for the docente in that materia.
 *
 * resolveAssignedGrupos internal steps (teacher path, shared):
 *   1. Fetch cycleId from CourseCycle via TenantContext (raw Prisma).
 *   2. findByUserAndCycle(userId, cycleId) → DocenteXCiclo.
 *   3. findFirst MateriaXCursoXCiclo for (courseCycleId, subjectId).
 *   4. findGroupsForDocente(docenteXCicloId, materiaXCursoXCicloId).
 *   → groups.length > 0 means the teacher IS assigned.
 *
 * canAccessCourseCycle internal steps (teacher path):
 *   Same steps 1–2, then:
 *   3. findByDocente(docenteXCicloId) → all groups for this dxc.
 *   4. findFirst MateriaXCursoXCiclo matching any group's materiaId AND this CC.
 *   → match found means the teacher has at least one subject in the CC.
 */
import { Injectable } from '@nestjs/common';
import { resolveAccessScope } from '@educandow/domain';
import type {
  DocenteXCicloRepository,
  GrupoRepository,
  AlumnosXGrupoRepository,
  AssignmentAuthorizerPort,
  StudentScope,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

@Injectable()
export class AssignmentAuthorizer implements AssignmentAuthorizerPort {
  constructor(
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository,
  ) {}

  /**
   * Resolves the assigned grupos for a (teacher, courseCycle, subject) tuple.
   * Returns the grupo list (may be []) when all authz links are valid.
   * Returns null when any link in the chain is missing:
   *   no tenant client, no CourseCycle, no DocenteXCiclo, no MateriaXCursoXCiclo.
   *
   * Used by both canWriteGrades and getAllowedStudentIds — ADR-3.
   */
  private async resolveAssignedGrupos(
    userId: string,
    courseCycleId: string,
    subjectId: string,
  ): Promise<{ id: string; materiaXCursoXCicloId: string; docenteXCicloId: string }[] | null> {
    const client = TenantContext.getClient();
    if (!client) return null;

    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) return null;

    const dxc = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!dxc) return null;

    const materia = await client.materiaXCursoXCiclo.findFirst({
      where: { courseCycleId, subjectId },
      select: { id: true },
    });
    if (!materia) return null;

    return this.grupoRepo.findGroupsForDocente(dxc.id, materia.id);
  }

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

    // ── Door 3: teacher group-assignment check (via shared resolver) ──────────
    const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
    return grupos !== null && grupos.length > 0;
  }

  async getAllowedStudentIds(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
    subjectId: string,
  ): Promise<StudentScope> {
    // ── Door 2: administrative bypass → all students visible ─────────────────
    const scope = resolveAccessScope({ roles: userRoles });
    if (scope.isAdministrative) {
      return 'all';
    }

    // ── Door 3: teacher path → resolve grupos, then fetch student IDs ─────────
    const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
    if (grupos === null || grupos.length === 0) return null;

    return this.alumnosXGrupoRepo.findStudentIdsByGrupoIds(grupos.map((g) => g.id));
  }

  async canAccessCourseCycle(
    userId: string,
    userRoles: string[],
    courseCycleId: string,
  ): Promise<boolean> {
    // ── Door 2: management bypass (D3) ───────────────────────────────────────
    const scope = resolveAccessScope({ roles: userRoles });
    if (scope.isAdministrative) {
      return true;
    }

    // ── Door 3: teacher group-assignment check (any materia in CC) ───────────
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

    // Step 3: Find all grupos for this docente (across all materias in any CC)
    const grupos = await this.grupoRepo.findByDocente(dxc.id);
    if (grupos.length === 0) return false;

    // Step 4: Check if any grupo's materia belongs to this CC
    const materiaIds = grupos.map((g) => g.materiaXCursoXCicloId);
    const materia = await client.materiaXCursoXCiclo.findFirst({
      where: { id: { in: materiaIds }, courseCycleId },
      select: { id: true },
    });
    return !!materia;
  }
}
