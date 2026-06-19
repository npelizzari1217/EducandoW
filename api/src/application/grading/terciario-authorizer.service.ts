/**
 * TerciarioAuthorizerService — application service (Fase D).
 *
 * Implements TerciarioAuthorizerPort. Door 3 for Terciario grading.
 * Mirrors AssignmentAuthorizer (Primario/Secundario) but keyed on
 * (userId, materiaCarreraId, anioAcademico) — no AcademicCycle chain.
 *
 * 3-door model:
 *   Door 1: module/action check — enforced by guard (GRADES:CREATE/UPDATE).
 *   Door 2: rank >= SECRETARIO → bypass (isAdministrative).
 *   Door 3: DocenteXMateriaCarreraRepository.findActiveAssignment.
 *
 * Fail-closed: missing tenant client or missing inscripcion → false/null, never throws.
 */
import { Injectable } from '@nestjs/common';
import { resolveAccessScope } from '@educandow/domain';
import type {
  TerciarioAuthorizerPort,
  DocenteXMateriaCarreraRepository,
  StudentScope,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

@Injectable()
export class TerciarioAuthorizerService implements TerciarioAuthorizerPort {
  constructor(
    private readonly repo: DocenteXMateriaCarreraRepository,
  ) {}

  /** Private Door 3 helper — mirrors AssignmentAuthorizer.resolveAssignedGrupos (ADR-3). */
  private async isAssigned(
    userId: string,
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<boolean> {
    return (await this.repo.findActiveAssignment(userId, materiaCarreraId, anioAcademico)) !== null;
  }

  async canWriteGrades(
    userId: string,
    userRoles: string[],
    inscripcionMateriaId: string,
  ): Promise<boolean> {
    // Door 2: administrative bypass (SPEC-3.2)
    if (resolveAccessScope({ roles: userRoles }).isAdministrative) return true;

    // Fail-closed: no tenant client (SPEC-8.6 / SPEC-8.A)
    const client = TenantContext.getClient();
    if (!client) return false;

    // Resolve materiaCarreraId + anioAcademico from inscripcion (SPEC-3.4)
    const insc = await client.inscripcionMateria.findUnique({
      where: { id: inscripcionMateriaId },
      select: { materiaCarreraId: true, anioAcademico: true },
    });
    if (!insc) return false; // null-data safety (SPEC-3.3)

    // Door 3
    return this.isAssigned(userId, insc.materiaCarreraId, insc.anioAcademico);
  }

  async getAllowedStudentIds(
    userId: string,
    userRoles: string[],
    materiaCarreraId: string,
    anioAcademico: string,
  ): Promise<StudentScope> {
    // Door 2: administrative bypass (SPEC-3.2)
    if (resolveAccessScope({ roles: userRoles }).isAdministrative) return 'all';

    // Fail-closed: no tenant client
    const client = TenantContext.getClient();
    if (!client) return null;

    // Door 3
    if (!(await this.isAssigned(userId, materiaCarreraId, anioAcademico))) return null;

    // Return all studentIds of the materia/year (co-teaching → full list, SPEC-7 intent)
    const rows = await client.inscripcionMateria.findMany({
      where: { materiaCarreraId, anioAcademico },
      select: { studentId: true },
    });
    return rows.map((r: { studentId: string }) => r.studentId);
  }
}
