import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateRegimenSchema, CreateRegimenDTO } from './dto/create-regimen.dto';
import { UpdateRegimenSchema, UpdateRegimenDTO } from './dto/update-regimen.dto';
import {
  CreateRegimenAcademicoUseCase,
  GetRegimenAcademicoUseCase,
  UpdateRegimenAcademicoUseCase,
} from '../../application/nivel-secundario/use-cases/regimen-academico.use-cases';
import { RegimenAcademico } from '@educandow/domain';

@Controller('v1/secundario/regimen-academico')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class RegimenAcademicoController {
  constructor(
    private readonly createUC: CreateRegimenAcademicoUseCase,
    private readonly getUC: GetRegimenAcademicoUseCase,
    private readonly updateUC: UpdateRegimenAcademicoUseCase,
  ) {}

  @Post()
  async create(@Body(new ZodValidationPipe(CreateRegimenSchema)) body: CreateRegimenDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get(':cursoId/:subjectId')
  async get(@Param('cursoId') cursoId: string, @Param('subjectId') subjectId: string) {
    const result = await this.getUC.executeByCursoAndSubject(cursoId, subjectId);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRegimenSchema)) body: UpdateRegimenDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }
}

function toDto(r: RegimenAcademico) {
  return {
    id: r.id.get(),
    cursoId: r.cursoId,
    subjectId: r.subjectId,
    promocionDirecta: r.promocionDirecta,
    requiereExamenFinal: r.requiereExamenFinal,
    notaMinimaAprobacion: r.notaMinimaAprobacion,
  };
}
