import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreatePlanificacionSchema, type CreatePlanificacionDTO } from './dto/create-planificacion.dto';
import { UpdatePlanificacionSchema, type UpdatePlanificacionDTO } from './dto/update-planificacion.dto';
import {
  CreatePlanificacionUseCase,
  ListPlanificacionesUseCase,
  UpdatePlanificacionUseCase,
} from '../../application/nivel-inicial/use-cases/planificacion.use-cases';

@Controller('v1/inicial/planificaciones')
@UseGuards(AuthGuard, RolesGuard)
export class PlanificacionController {
  constructor(
    private readonly createUC: CreatePlanificacionUseCase,
    private readonly listUC: ListPlanificacionesUseCase,
    private readonly updateUC: UpdatePlanificacionUseCase,
  ) {}

  @Post()
  @Roles('TEACHER', 'ADMIN', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreatePlanificacionSchema)) body: CreatePlanificacionDTO) {
    const result = await this.createUC.execute({
      salaId: body.salaId,
      semana: body.semana,
      academicYear: body.academicYear,
      secuencias: body.secuencias,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapPlanificacion(result.unwrap()) };
  }

  @Get()
  @Roles('TEACHER', 'ADMIN', 'MANAGER')
  async list(
    @Query('salaId') salaId?: string,
    @Query('semana') semana?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const result = await this.listUC.execute({
      salaId,
      semana: semana ? Number(semana) : undefined,
      academicYear,
    });
    return { data: result.unwrap().map((p) => this.mapPlanificacion(p)) };
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlanificacionSchema)) body: UpdatePlanificacionDTO,
  ) {
    const result = await this.updateUC.execute(id, {
      semana: body.semana,
      academicYear: body.academicYear,
      secuencias: body.secuencias,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapPlanificacion(result.unwrap()) };
  }

  private mapPlanificacion(p: { id: { get(): string }; salaId: string; semana: number; academicYear: string; active: boolean; deletedAt?: Date; secuencias: Array<{ id: string; planificacionId: string; nombre: string; area: string; actividades: string[]; recursos: string[] }> }) {
    return {
      id: p.id.get(),
      salaId: p.salaId,
      semana: p.semana,
      academicYear: p.academicYear,
      active: p.active,
      deletedAt: p.deletedAt,
      secuencias: p.secuencias,
    };
  }
}
