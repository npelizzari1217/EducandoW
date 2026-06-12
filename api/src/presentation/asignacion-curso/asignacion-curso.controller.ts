import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  AssignDocenteToCursoSchema,
  AssignDocenteToCursoDto,
  type AsignacionCursoResponse,
} from './dto/asignacion-curso.dto';
import { AssignDocenteToCursoUseCase } from '../../application/asignacion-curso/assign-docente-to-curso.use-case';
import { ListAsignacionesCursoUseCase } from '../../application/asignacion-curso/list-asignaciones-curso.use-case';
import { RemoveAsignacionCursoUseCase } from '../../application/asignacion-curso/remove-asignacion-curso.use-case';
import type { AsignacionCursoXCiclo } from '@educandow/domain';

/**
 * AsignacionCursoController — Fase 4 (F4-P1..P3).
 *
 * Endpoints nested under /course-cycles/:ccId/asignaciones.
 * Handles PRECEPTOR and TITULAR assignment at the CursoXCiclo level.
 *
 * NOTE: cycleId is required in the request body (not in the URL) because
 * this controller doesn't load the full CourseCycle record. Callers resolve
 * cycleId from the CourseCycle they already have in the frontend context.
 */
@Controller('course-cycles/:ccId/asignaciones')
@UseGuards(AuthGuard, RolesGuard)
export class AsignacionCursoController {
  constructor(
    private readonly assignUC: AssignDocenteToCursoUseCase,
    private readonly listUC: ListAsignacionesCursoUseCase,
    private readonly removeUC: RemoveAsignacionCursoUseCase,
  ) {}

  /**
   * POST /course-cycles/:ccId/asignaciones — F4-P1
   * Assign a DocenteXCiclo as PRECEPTOR or TITULAR to a CursoXCiclo.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'WRITE' })
  async assign(
    @Param('ccId') ccId: string,
    @Body(new ZodValidationPipe(AssignDocenteToCursoSchema))
    dto: AssignDocenteToCursoDto,
  ): Promise<{ data: AsignacionCursoResponse }> {
    const result = await this.assignUC.execute({
      courseCycleId: ccId,
      courseCycleUuid: ccId,
      cycleId: dto.cycleId,
      userId: dto.userId,
      rol: dto.rol,
      turno: dto.turno,
    });
    return { data: this.toResponse(result) };
  }

  /**
   * GET /course-cycles/:ccId/asignaciones — F4-P2
   * List all DocenteXCiclo assignments for a CursoXCiclo.
   */
  @Get()
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async list(
    @Param('ccId') ccId: string,
  ): Promise<{ data: AsignacionCursoResponse[] }> {
    const items = await this.listUC.execute({ courseCycleId: ccId });
    return { data: items.map((a) => this.toResponse(a)) };
  }

  /**
   * DELETE /course-cycles/:ccId/asignaciones/:id — F4-P3
   * Remove a specific assignment from a CursoXCiclo.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'WRITE' })
  async remove(
    @Param('ccId') ccId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.removeUC.execute({ courseCycleId: ccId, asignacionId: id });
  }

  private toResponse(a: AsignacionCursoXCiclo): AsignacionCursoResponse {
    return {
      id: a.id,
      courseCycleId: a.courseCycleId,
      docenteXCicloId: a.docenteXCicloId,
      rol: a.rol,
      turno: a.turno,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
