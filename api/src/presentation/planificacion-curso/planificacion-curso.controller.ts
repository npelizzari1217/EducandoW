import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreatePlanificacionCursoSchema, CreatePlanificacionCursoDto,
  UpdatePlanificacionCursoSchema, UpdatePlanificacionCursoDto,
  type PlanificacionCursoResponse,
} from './dto/planificacion-curso.dto';
import { CreatePlanificacionCursoUseCase } from '../../application/planificacion-curso/create-planificacion-curso.use-case';
import { ListPlanificacionesCursoUseCase } from '../../application/planificacion-curso/list-planificaciones-curso.use-case';
import { UpdatePlanificacionCursoUseCase } from '../../application/planificacion-curso/update-planificacion-curso.use-case';
import { DeletePlanificacionCursoUseCase } from '../../application/planificacion-curso/delete-planificacion-curso.use-case';
import type { PlanificacionCurso } from '@educandow/domain';

@Controller('course-cycles/:ccId')
@UseGuards(AuthGuard, RolesGuard)
export class PlanificacionCursoController {
  constructor(
    private readonly createUC: CreatePlanificacionCursoUseCase,
    private readonly listUC: ListPlanificacionesCursoUseCase,
    private readonly updateUC: UpdatePlanificacionCursoUseCase,
    private readonly deleteUC: DeletePlanificacionCursoUseCase,
  ) {}

  @Post('asignaciones/:asignacionId/planificaciones')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'WRITE' })
  async create(
    @Param('asignacionId') asignacionId: string,
    @Body(new ZodValidationPipe(CreatePlanificacionCursoSchema)) dto: CreatePlanificacionCursoDto,
  ): Promise<{ data: PlanificacionCursoResponse }> {
    const result = await this.createUC.execute({
      asignacionCursoId: asignacionId,
      nombre: dto.nombre,
      periodOrdinal: dto.periodOrdinal,
      descripcion: dto.descripcion,
    });
    return { data: this.toResponse(result) };
  }

  @Get('asignaciones/:asignacionId/planificaciones')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async list(
    @Param('asignacionId') asignacionId: string,
  ): Promise<{ data: PlanificacionCursoResponse[] }> {
    const items = await this.listUC.execute({ asignacionCursoId: asignacionId });
    return { data: items.map((p) => this.toResponse(p)) };
  }

  @Patch('planificaciones/:id')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'WRITE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlanificacionCursoSchema)) dto: UpdatePlanificacionCursoDto,
  ): Promise<{ data: PlanificacionCursoResponse }> {
    const result = await this.updateUC.execute({ id, ...dto });
    return { data: this.toResponse(result) };
  }

  @Delete('planificaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'WRITE' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteUC.execute({ id });
  }

  private toResponse(p: PlanificacionCurso): PlanificacionCursoResponse {
    return {
      id: p.id,
      asignacionCursoId: p.asignacionCursoId,
      nombre: p.nombre,
      periodOrdinal: p.periodOrdinal,
      descripcion: p.descripcion,
      active: p.active,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
