import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateMesaExamenSchema, CreateMesaExamenDTO } from './dto/create-mesa-examen.dto';
import { InscribirAlumnoSchema, InscribirAlumnoDTO } from './dto/inscribir-alumno.dto';
import {
  CreateMesaExamenUseCase,
  ListMesasExamenUseCase,
  GetMesaExamenUseCase,
  InscribirAlumnoUseCase,
  ListInscripcionesUseCase,
} from '../../application/nivel-secundario/use-cases/mesa-examen.use-cases';
import { MesaExamen, MesaExamenInscripcionProps } from '@educandow/domain';

@Controller('v1/secundario/mesas-examen')
@UseGuards(AuthGuard, RolesGuard)
export class MesaExamenController {
  constructor(
    private readonly createUC: CreateMesaExamenUseCase,
    private readonly listUC: ListMesasExamenUseCase,
    private readonly getUC: GetMesaExamenUseCase,
    private readonly inscribirUC: InscribirAlumnoUseCase,
    private readonly listInscripcionesUC: ListInscripcionesUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateMesaExamenSchema)) body: CreateMesaExamenDTO) {
    const result = await this.createUC.execute({
      ...body,
      fecha: new Date(body.fecha),
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async list(@Query('subjectId') subjectId?: string) {
    const mesas = await this.listUC.execute(subjectId);
    return { data: mesas.map(toDto) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async get(@Param('id') id: string) {
    const result = await this.getUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Post(':id/inscripciones')
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async inscribirAlumno(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InscribirAlumnoSchema)) body: InscribirAlumnoDTO,
  ) {
    const result = await this.inscribirUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: { mesaId: id, studentId: body.studentId } };
  }

  @Get(':id/inscripciones')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async listInscripciones(@Param('id') id: string) {
    const result = await this.listInscripcionesUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map(toInscripcionDto) };
  }
}

function toDto(mesa: MesaExamen) {
  return {
    id: mesa.id.get(),
    subjectId: mesa.subjectId,
    fecha: mesa.fecha.toISOString(),
    turno: mesa.turno.get(),
    presidenteId: mesa.presidenteId,
    active: mesa.active,
    totalInscriptos: mesa.inscripciones.length,
  };
}

function toInscripcionDto(i: MesaExamenInscripcionProps) {
  return {
    id: i.id.get(),
    mesaId: i.mesaId,
    studentId: i.studentId,
    notaFinal: i.notaFinal,
    condicionFinal: i.condicionFinal,
  };
}
