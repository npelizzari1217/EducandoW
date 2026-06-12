/**
 * RecordSubjectAbsenceUseCase — application use-case (Fase 6, F6-A1).
 *
 * Records a subject-level absence for a student in a GrupoXCursoXMateriaXCiclo.
 *
 * Authorization model (3 doors):
 *   Door 1 — module ATTENDANCE:CREATE (enforced at controller via @Roles).
 *   Door 2 — group assignment: userId must be the DocenteXCiclo of the grupo.
 *   D3     — SECRETARIO/DIRECTOR/ADMIN/ROOT bypass Door 2.
 *
 * Resolution steps for Door 2 (teacher path):
 *   1. Get grupo by id → grupo.docenteXCicloId + grupo.materiaXCursoXCicloId
 *   2. Get materiaXCursoXCiclo → courseCycleId
 *   3. Get CourseCycle → cycleId (raw Prisma via TenantContext)
 *   4. findByUserAndCycle(userId, cycleId) → DocenteXCiclo
 *   5. Check DocenteXCiclo.id === grupo.docenteXCicloId
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

export interface RecordSubjectAbsenceInput {
  grupoId: string;
  studentId: string;
  date: Date;
  observaciones?: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class RecordSubjectAbsenceUseCase {
  constructor(
    private readonly absenceRepo: SubjectAbsenceRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
  ) {}

  async execute(input: RecordSubjectAbsenceInput): Promise<AusenciaXGrupo> {
    const scope = resolveAccessScope({ roles: input.userRoles });

    // D3: management roles bypass Door 2
    if (!scope.isAdministrative) {
      await this.checkDoor2(input.grupoId, input.userId);
    }

    return this.absenceRepo.record({
      grupoId: input.grupoId,
      studentId: input.studentId,
      date: input.date,
      observaciones: input.observaciones,
    });
  }

  private async checkDoor2(grupoId: string, userId: string): Promise<void> {
    // Step 1: get grupo
    const grupo = await this.grupoRepo.findById(grupoId);
    if (!grupo) {
      throw new ForbiddenError('Group not found — authorization failed');
    }

    // Step 2: get materia → courseCycleId
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

    // Step 3: get cycleId from CourseCycle
    const cc = await client.courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    // Step 4: resolve DocenteXCiclo for this user in this cycle
    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    // Step 5: check group ownership
    if (docente.id !== grupo.docenteXCicloId) {
      throw new ForbiddenError('User is not assigned to this group');
    }
  }
}
