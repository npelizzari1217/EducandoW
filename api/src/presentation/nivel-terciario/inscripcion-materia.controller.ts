import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateInscripcionSchema, CreateInscripcionDTO,
  UpdateInscripcionEstadoSchema, UpdateInscripcionEstadoDTO,
} from '../auth/dto/register.request';
import {
  CreateInscripcionUC, ListInscripcionesUC, GetInscripcionUC, UpdateInscripcionEstadoUC,
} from '../../application/nivel-terciario/use-cases/inscripcion-materia.use-cases';
import type { InscripcionMateria } from '@educandow/domain';

@Controller('v1/terciario/inscripciones')
@UseGuards(AuthGuard, RolesGuard)
export class InscripcionMateriaController {
  constructor(
    private readonly createUC: CreateInscripcionUC,
    private readonly listUC: ListInscripcionesUC,
    private readonly getUC: GetInscripcionUC,
    private readonly updateEstadoUC: UpdateInscripcionEstadoUC,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreateInscripcionSchema)) body: CreateInscripcionDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'MANAGER')
  async list(
    @Query('studentId') studentId?: string,
    @Query('materiaCarreraId') materiaCarreraId?: string,
  ) {
    const items = await this.listUC.execute(studentId, materiaCarreraId);
    return { data: items.map((i) => this.map(i)) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'MANAGER')
  async get(@Param('id') id: string) {
    const item = await this.getUC.execute(id);
    if (!item) return { data: null };
    return { data: this.map(item) };
  }

  @Patch(':id/estado')
  @Roles('ADMIN', 'MANAGER', 'MANAGER')
  async updateEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInscripcionEstadoSchema)) body: UpdateInscripcionEstadoDTO,
  ) {
    const result = await this.updateEstadoUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  private map(i: InscripcionMateria) {
    return {
      id: i.id.get(),
      studentId: i.studentId,
      materiaCarreraId: i.materiaCarreraId,
      cuatrimestre: i.cuatrimestre,
      anioAcademico: i.anioAcademico,
      estado: i.estado.get(),
      notaCursada: i.notaCursada,
      notaFinal: i.notaFinal,
    };
  }
}
