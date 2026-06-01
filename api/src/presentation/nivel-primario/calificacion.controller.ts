import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateCalificacionSchema, CreateCalificacionDTO } from './dto/create-calificacion.dto';
import { UpdateCalificacionSchema, UpdateCalificacionDTO } from './dto/update-calificacion.dto';
import {
  CreateCalificacionUseCase,
  ListCalificacionesUseCase,
  GetCalificacionUseCase,
  UpdateCalificacionUseCase,
} from '../../application/nivel-primario/use-cases/calificacion.use-cases';
import type { CalificacionPrimario } from '@educandow/domain';

function toDto(c: CalificacionPrimario) {
  return {
    id: c.id.get(),
    studentId: c.studentId,
    gradoId: c.gradoId,
    subjectId: c.subjectId,
    trimestre: c.trimestre.value,
    nota: c.nota,
    concepto: c.concepto,
    aprobado: c.aprobado,
  };
}

@Controller('v1/primario/calificaciones')
@UseGuards(AuthGuard, RolesGuard)
export class CalificacionController {
  constructor(
    private readonly createUC: CreateCalificacionUseCase,
    private readonly listUC: ListCalificacionesUseCase,
    private readonly getUC: GetCalificacionUseCase,
    private readonly updateUC: UpdateCalificacionUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateCalificacionSchema)) body: CreateCalificacionDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async list(
    @Query('gradoId') gradoId?: string,
    @Query('studentId') studentId?: string,
  ) {
    const calificaciones = await this.listUC.execute(gradoId, studentId);
    return { data: calificaciones.map(toDto) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async get(@Param('id') id: string) {
    const calificacion = await this.getUC.execute(id);
    if (!calificacion) return { data: null };
    return { data: toDto(calificacion) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCalificacionSchema)) body: UpdateCalificacionDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }
}
