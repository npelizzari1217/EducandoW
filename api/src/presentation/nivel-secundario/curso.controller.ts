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
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateCursoSchema, CreateCursoDTO } from './dto/create-curso.dto';
import { UpdateCursoSchema, UpdateCursoDTO } from './dto/update-curso.dto';
import {
  CreateCursoUseCase,
  ListCursosUseCase,
  GetCursoUseCase,
  UpdateCursoUseCase,
  DeleteCursoUseCase,
} from '../../application/nivel-secundario/use-cases/curso.use-cases';
import { Curso } from '@educandow/domain';

@Controller('v1/secundario/cursos')
@UseGuards(AuthGuard, RolesGuard)
export class CursoController {
  constructor(
    private readonly createUC: CreateCursoUseCase,
    private readonly listUC: ListCursosUseCase,
    private readonly getUC: GetCursoUseCase,
    private readonly updateUC: UpdateCursoUseCase,
    private readonly deleteUC: DeleteCursoUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'COURSES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateCursoSchema)) body: CreateCursoDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async list(@Query('academicYear') academicYear?: string) {
    const cursos = await this.listUC.execute(academicYear);
    return { data: cursos.map(toDto) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async get(@Param('id') id: string) {
    const result = await this.getUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCursoSchema)) body: UpdateCursoDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'COURSES', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const result = await this.deleteUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
  }
}

function toDto(curso: Curso) {
  return {
    id: curso.id.get(),
    courseSectionId: curso.courseSectionId,
    year: curso.year,
    division: curso.division,
    orientacion: curso.orientacion?.get(),
    academicYear: curso.academicYear,
    active: curso.active,
  };
}
