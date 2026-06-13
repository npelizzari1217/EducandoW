import { Injectable } from '@nestjs/common';
import type { GrupoRepository, MateriaXCursoXCicloRepository, GrupoXCursoXMateriaXCiclo } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';
import { DocenteXCicloService } from '../docente-ciclo/docente-x-ciclo.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { validateTeacherLevel } from './validate-teacher-level';

/**
 * UpdateGrupoUseCase — edits name and/or reassigns docente of a grupo.
 *
 * If userId is provided:
 *  1. Validates teacher level against the materia's course-cycle.
 *  2. Gets or creates the DocenteXCiclo for the new user in the cycle.
 *  3. Updates grupoRepo with the new docenteXCicloId.
 */
@Injectable()
export class UpdateGrupoUseCase {
  constructor(
    private readonly grupoRepo: GrupoRepository,
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly docenteService: DocenteXCicloService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    id: string;
    name?: string;
    userId?: string;
  }): Promise<GrupoXCursoXMateriaXCiclo> {
    const grupo = await this.grupoRepo.findById(input.id);
    if (!grupo) throw new NotFoundError('GrupoXCursoXMateriaXCiclo', input.id);

    let docenteXCicloId: string | undefined;

    if (input.userId !== undefined) {
      const materia = await this.materiaRepo.findById(grupo.materiaXCursoXCicloId);
      if (!materia) throw new NotFoundError('MateriaXCursoXCiclo', grupo.materiaXCursoXCicloId);

      await validateTeacherLevel(this.prisma, input.userId, materia.courseCycleId);

      const client = TenantContext.getClient();
      if (!client) throw new Error('No tenant client available');

      const cc = await client.courseCycle.findUnique({
        where: { uuid: materia.courseCycleId },
        select: { cycleId: true },
      });
      if (!cc) throw new NotFoundError('CourseCycle', materia.courseCycleId);

      const newDocente = await this.docenteService.getOrCreateForCycle(input.userId, cc.cycleId);
      docenteXCicloId = newDocente.id;
    }

    return this.grupoRepo.update(input.id, {
      name: input.name,
      docenteXCicloId,
    });
  }
}
