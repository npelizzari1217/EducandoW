import { Injectable } from '@nestjs/common';
import type {
  MateriaXCursoXCicloRepository,
  GrupoRepository,
  GrupoXCursoXMateriaXCiclo,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';
import { DocenteXCicloService } from '../docente-ciclo/docente-x-ciclo.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { validateTeacherLevel } from './validate-teacher-level';

/**
 * CreateGrupoUseCase — Fase 3c (F3-A3).
 *
 * Creates a GrupoXCursoXMateriaXCiclo for a MateriaXCursoXCiclo, assigning
 * exactly one DocenteXCiclo (MGC-R3). The DocenteXCiclo is obtained (or created)
 * idempotently for the userId + cycleId pair via DocenteXCicloService.
 *
 * cycleId is passed explicitly by the caller (resolved from CourseCycle at the
 * presentation layer, where the `:ccId` route param is available). This avoids
 * a CourseCycleRepository dependency here and prevents a circular module dependency.
 *
 * Split subjects (materia partida — MGC-S8): the @@unique([materiaId, docenteXCicloId])
 * at DB level allows multiple groups if different docentes are used.
 *
 * Level validation: the teacher's composite levels must include the course-cycle's
 * composite level. ROOT and ADMIN users have allLevels and bypass this check.
 */
@Injectable()
export class CreateGrupoUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly docenteService: DocenteXCicloService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    materiaXCursoXCicloId: string;
    userId: string;
    /** AcademicCycle UUID — resolved by the caller from the CourseCycle. */
    cycleId: string;
    name?: string;
  }): Promise<GrupoXCursoXMateriaXCiclo> {
    // Validate materia exists
    const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
    }

    // Validate teacher's level matches the materia's course-cycle level
    await validateTeacherLevel(this.prisma, input.userId, materia.courseCycleId);

    // Get or create the DocenteXCiclo for this user in this cycle (idempotent)
    const docenteXCiclo = await this.docenteService.getOrCreateForCycle(input.userId, input.cycleId);

    // Persist the group
    return this.grupoRepo.create({
      materiaXCursoXCicloId: input.materiaXCursoXCicloId,
      docenteXCicloId: docenteXCiclo.id,
      name: input.name,
    });
  }

}
