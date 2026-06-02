import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateSalaSchema, type CreateSalaDTO } from './dto/create-sala.dto';
import { UpdateSalaSchema, type UpdateSalaDTO } from './dto/update-sala.dto';
import {
  CreateSalaUseCase,
  ListSalasUseCase,
  GetSalaUseCase,
  UpdateSalaUseCase,
  DeleteSalaUseCase,
} from '../../application/nivel-inicial/use-cases/sala.use-cases';

@Controller('inicial/salas')
@UseGuards(AuthGuard, RolesGuard)
export class SalaController {
  constructor(
    private readonly createUC: CreateSalaUseCase,
    private readonly listUC: ListSalasUseCase,
    private readonly getUC: GetSalaUseCase,
    private readonly updateUC: UpdateSalaUseCase,
    private readonly deleteUC: DeleteSalaUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'CLASSROOMS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateSalaSchema)) body: CreateSalaDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const sala = result.unwrap();
    return { data: this.mapSala(sala) };
  }

  @Get()
  @Roles('ROOT', { module: 'CLASSROOMS', action: 'READ' })
  async list(
    @Query('academicYear') academicYear?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('turno') turno?: string,
  ) {
    const filters = {
      academicYear,
      ageGroup: ageGroup ? Number(ageGroup) : undefined,
      turno,
    };
    const result = await this.listUC.execute(filters);
    const salas = result.unwrap();
    return { data: salas.map((s) => this.mapSala(s)) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'CLASSROOMS', action: 'READ' })
  async get(@Param('id') id: string) {
    const result = await this.getUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapSala(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'CLASSROOMS', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSalaSchema)) body: UpdateSalaDTO,
  ) {
    const input = {
      ...body,
      teacherId: body.teacherId === null ? undefined : body.teacherId,
    };
    const result = await this.updateUC.execute(id, input);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapSala(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'CLASSROOMS', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const result = await this.deleteUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
  }

  private mapSala(sala: { id: { get(): string }; name: string; ageGroup: { get(): number }; turno: { get(): string }; capacity: number; teacherId?: string; academicYear: string; active: boolean; deletedAt?: Date }) {
    return {
      id: sala.id.get(),
      name: sala.name,
      ageGroup: sala.ageGroup.get(),
      turno: sala.turno.get(),
      capacity: sala.capacity,
      teacherId: sala.teacherId,
      academicYear: sala.academicYear,
      active: sala.active,
      deletedAt: sala.deletedAt,
    };
  }
}
