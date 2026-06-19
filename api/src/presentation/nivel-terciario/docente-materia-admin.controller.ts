import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { EducationalLevelCode } from '@educandow/domain';
import type { DocenteXMateriaCarrera } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import {
  AssignDocenteMateriaUC,
  ListAssignmentsUC,
  UnassignDocenteMateriaUC,
} from '../../application/nivel-terciario/use-cases/docente-materia.use-cases';

// ── Zod Schemas ────────────────────────────────────────────────────────────────

const AssignDocenteSchema = z.object({
  userId: z.string().min(1),
  materiaCarreraId: z.string().min(1),
  anioAcademico: z.string().min(4),
});
type AssignDocenteDTO = z.infer<typeof AssignDocenteSchema>;

const ListAssignmentsQuerySchema = z.object({
  materiaCarreraId: z.string().optional(),
  userId: z.string().optional(),
  anioAcademico: z.string().optional(),
}).refine(q => q.materiaCarreraId || q.userId, {
  message: 'materiaCarreraId or userId required',
});
type ListAssignmentsQueryDTO = z.infer<typeof ListAssignmentsQuerySchema>;

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('terciario/admin/docentes-materias')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
export class DocenteMateriaAdminController {
  constructor(
    private readonly assignUC: AssignDocenteMateriaUC,
    private readonly listUC: ListAssignmentsUC,
    private readonly unassignUC: UnassignDocenteMateriaUC,
  ) {}

  /** POST /terciario/admin/docentes-materias — assign docente to materia (SPEC-4.2) */
  @Post()
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AssignDocenteSchema)) body: AssignDocenteDTO,
  ) {
    const result = await this.assignUC.execute(user.roles, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapAssignment(result.unwrap()) };
  }

  /** GET /terciario/admin/docentes-materias — list by materia or docente (SPEC-4.3/4.4) */
  @Get()
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListAssignmentsQuerySchema)) query: ListAssignmentsQueryDTO,
  ) {
    const result = await this.listUC.execute(user.roles, {
      materiaCarreraId: query.materiaCarreraId,
      userId: query.userId,
      anioAcademico: query.anioAcademico,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map((a) => this.mapAssignment(a)) };
  }

  /** PATCH /terciario/admin/docentes-materias/:id/unassign — soft unassign (SPEC-4.5) */
  @Patch(':id/unassign')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async unassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.unassignUC.execute(user.roles, id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapAssignment(result.unwrap()) };
  }

  private mapAssignment(a: DocenteXMateriaCarrera) {
    return {
      id: a.id,
      userId: a.userId,
      materiaCarreraId: a.materiaCarreraId,
      anioAcademico: a.anioAcademico,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
