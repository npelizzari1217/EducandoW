import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateCarreraSchema, CreateCarreraDTO, UpdateCarreraSchema, UpdateCarreraDTO } from '../auth/dto/register.request';
import {
  CreateCarreraUC, ListCarrerasUC, GetCarreraUC, UpdateCarreraUC, DeleteCarreraUC,
} from '../../application/nivel-terciario/use-cases/carrera.use-cases';
import type { Carrera } from '@educandow/domain';

@Controller('v1/terciario/carreras')
@UseGuards(AuthGuard, RolesGuard)
export class CarreraController {
  constructor(
    private readonly createUC: CreateCarreraUC,
    private readonly listUC: ListCarrerasUC,
    private readonly getUC: GetCarreraUC,
    private readonly updateUC: UpdateCarreraUC,
    private readonly deleteUC: DeleteCarreraUC,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ROOT')
  async create(@Body(new ZodValidationPipe(CreateCarreraSchema)) body: CreateCarreraDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ROOT', 'MANAGER')
  async list() {
    const carreras = await this.listUC.execute();
    return { data: carreras.map((c) => this.map(c)) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ROOT', 'MANAGER')
  async get(@Param('id') id: string) {
    const carrera = await this.getUC.execute(id);
    if (!carrera) return { data: null };
    return { data: this.map(carrera) };
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ROOT')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCarreraSchema)) body: UpdateCarreraDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.map(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ROOT')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }

  private map(c: Carrera) {
    return {
      id: c.id.get(),
      name: c.name,
      titulo: c.titulo,
      duracion: c.duracion,
      resolucion: c.resolucion,
      active: c.active,
    };
  }
}
