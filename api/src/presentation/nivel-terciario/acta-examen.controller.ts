import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateActaExamenSchema, CreateActaExamenDTO,
  RegistrarNotaSchema, RegistrarNotaDTO,
} from '../auth/dto/register.request';
import {
  CreateActaExamenUC, ListActasExamenUC, GetActaExamenUC, RegistrarNotaUC,
} from '../../application/nivel-terciario/use-cases/acta-examen.use-cases';
import type { ActaExamen } from '@educandow/domain';

@Controller('v1/terciario/actas-examen')
@UseGuards(AuthGuard, RolesGuard)
export class ActaExamenController {
  constructor(
    private readonly createUC: CreateActaExamenUC,
    private readonly listUC: ListActasExamenUC,
    private readonly getUC: GetActaExamenUC,
    private readonly registrarNotaUC: RegistrarNotaUC,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreateActaExamenSchema)) body: CreateActaExamenDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async list(@Query('materiaCarreraId') materiaCarreraId?: string) {
    const items = await this.listUC.execute(materiaCarreraId);
    return { data: items.map((i) => this.map(i)) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  async get(@Param('id') id: string) {
    const item = await this.getUC.execute(id);
    if (!item) return { data: null };
    return { data: this.map(item) };
  }

  @Post(':id/notas')
  @Roles('ADMIN', 'MANAGER')
  async registrarNota(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RegistrarNotaSchema)) body: RegistrarNotaDTO,
  ) {
    const result = await this.registrarNotaUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: { message: 'Nota registrada' } };
  }

  private map(a: ActaExamen) {
    return {
      id: a.id.get(),
      materiaCarreraId: a.materiaCarreraId,
      fecha: a.fecha.toISOString(),
      presidenteId: a.presidenteId,
      vocales: a.vocales,
      libro: a.libro,
      folio: a.folio,
      active: a.active,
      notas: a.notas.map((n) => ({
        id: n.id,
        studentId: n.studentId,
        nota: n.nota,
        condicion: n.condicion.get(),
      })),
    };
  }
}
