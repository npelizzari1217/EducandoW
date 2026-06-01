import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateTituloSchema, CreateTituloDTO,
  UpdateTituloEstadoSchema, UpdateTituloEstadoDTO,
} from '../auth/dto/register.request';
import {
  CreateTituloUC, ListTitulosUC, GetTituloUC, UpdateTituloEstadoUC,
} from '../../application/nivel-terciario/use-cases/titulo.use-cases';
import type { Titulo } from '@educandow/domain';

@Controller('v1/terciario/titulos')
@UseGuards(AuthGuard, RolesGuard)
export class TituloController {
  constructor(
    private readonly createUC: CreateTituloUC,
    private readonly listUC: ListTitulosUC,
    private readonly getUC: GetTituloUC,
    private readonly updateEstadoUC: UpdateTituloEstadoUC,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'REPORTS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateTituloSchema)) body: CreateTituloDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async list(@Query('studentId') studentId?: string) {
    const items = await this.listUC.execute(studentId);
    return { data: items.map((i) => this.map(i)) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async get(@Param('id') id: string) {
    const item = await this.getUC.execute(id);
    if (!item) return { data: null };
    return { data: this.map(item) };
  }

  @Patch(':id/estado')
  @Roles('ROOT', { module: 'REPORTS', action: 'UPDATE' })
  async updateEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTituloEstadoSchema)) body: UpdateTituloEstadoDTO,
  ) {
    const result = await this.updateEstadoUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  private map(t: Titulo) {
    return {
      id: t.id.get(),
      studentId: t.studentId,
      carreraId: t.carreraId,
      fechaEgreso: t.fechaEgreso?.toISOString(),
      fechaEmision: t.fechaEmision?.toISOString(),
      estado: t.estado.get(),
      nroRegistro: t.nroRegistro,
    };
  }
}
