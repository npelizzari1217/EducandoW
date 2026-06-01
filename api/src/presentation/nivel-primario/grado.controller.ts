import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateGradoSchema, CreateGradoDTO } from './dto/create-grado.dto';
import { UpdateGradoSchema, UpdateGradoDTO } from './dto/update-grado.dto';
import {
  CreateGradoUseCase,
  ListGradosUseCase,
  GetGradoUseCase,
  UpdateGradoUseCase,
  DeleteGradoUseCase,
} from '../../application/nivel-primario/use-cases/grado.use-cases';
import type { Grado } from '@educandow/domain';

function toDto(g: Grado) {
  return {
    id: g.id.get(),
    courseSectionId: g.courseSectionId,
    grade: g.grade.value,
    division: g.division.value,
    teacherId: g.teacherId,
    academicYear: g.academicYear,
    active: g.active,
    deletedAt: g.deletedAt?.toISOString(),
  };
}

@Controller('v1/primario/grados')
@UseGuards(AuthGuard, RolesGuard)
export class GradoController {
  constructor(
    private readonly createUC: CreateGradoUseCase,
    private readonly listUC: ListGradosUseCase,
    private readonly getUC: GetGradoUseCase,
    private readonly updateUC: UpdateGradoUseCase,
    private readonly deleteUC: DeleteGradoUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'COURSES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateGradoSchema)) body: CreateGradoDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async list(@Query('academicYear') academicYear?: string) {
    const grados = await this.listUC.execute(academicYear);
    return { data: grados.map(toDto) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async get(@Param('id') id: string) {
    const grado = await this.getUC.execute(id);
    if (!grado) return { data: null };
    return { data: toDto(grado) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateGradoSchema)) body: UpdateGradoDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }
}
