import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { EducationalLevelCode } from '@educandow/domain';
import type { LlamadoExamen } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateLlamadoExamenSchema,
  CreateLlamadoExamenDTO,
  UpdateLlamadoExamenSchema,
  UpdateLlamadoExamenDTO,
  ListLlamadosExamenQuerySchema,
  ListLlamadosExamenQueryDTO,
} from './dto/llamado-examen.dto';
import {
  CreateLlamadoExamenUC,
  UpdateLlamadoExamenUC,
  ListLlamadosExamenUC,
  DeleteLlamadoExamenUC,
} from '../../application/nivel-terciario/use-cases/llamado-examen.use-cases';

function toDto(l: LlamadoExamen) {
  return {
    id: l.id.get(),
    nombre: l.nombre,
    anioAcademico: l.anioAcademico,
    fechaInicio: l.fechaInicio.toISOString(),
    fechaFin: l.fechaFin.toISOString(),
    active: l.active,
  };
}

@Controller('terciario/llamados-examen')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
export class LlamadoExamenController {
  constructor(
    private readonly createUC: CreateLlamadoExamenUC,
    private readonly listUC: ListLlamadosExamenUC,
    private readonly updateUC: UpdateLlamadoExamenUC,
    private readonly deleteUC: DeleteLlamadoExamenUC,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async create(
    @Body(new ZodValidationPipe(CreateLlamadoExamenSchema)) body: CreateLlamadoExamenDTO,
  ) {
    const result = await this.createUC.execute({
      nombre: body.nombre,
      anioAcademico: body.anioAcademico,
      fechaInicio: new Date(body.fechaInicio),
      fechaFin: new Date(body.fechaFin),
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async list(
    @Query(new ZodValidationPipe(ListLlamadosExamenQuerySchema)) query: ListLlamadosExamenQueryDTO,
  ) {
    const result = await this.listUC.execute(query.anioAcademico);
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map(toDto) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLlamadoExamenSchema)) body: UpdateLlamadoExamenDTO,
  ) {
    const result = await this.updateUC.execute(id, {
      nombre: body.nombre,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : undefined,
      fechaFin: body.fechaFin ? new Date(body.fechaFin) : undefined,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'GRADES', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const result = await this.deleteUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
  }
}
