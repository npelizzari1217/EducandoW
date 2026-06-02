import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Query,
} from '@nestjs/common';
import { EducationalLevelCode } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateInformeSchema, type CreateInformeDTO } from './dto/create-informe.dto';
import { UpdateInformeSchema, type UpdateInformeDTO } from './dto/update-informe.dto';
import {
  CreateInformeUseCase,
  GetInformeUseCase,
  ListInformesUseCase,
  UpdateInformeUseCase,
} from '../../application/nivel-inicial/use-cases/informe-evolutivo.use-cases';

@Controller('inicial/informes')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.INICIAL)
export class InformeEvolutivoController {
  constructor(
    private readonly createUC: CreateInformeUseCase,
    private readonly getUC: GetInformeUseCase,
    private readonly listUC: ListInformesUseCase,
    private readonly updateUC: UpdateInformeUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'REPORTS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateInformeSchema)) body: CreateInformeDTO) {
    const input = {
      studentId: body.studentId,
      salaId: body.salaId,
      periodo: body.periodo,
      fecha: body.fecha,
      observacionesGenerales: body.observacionesGenerales,
      areas: body.areas?.map((a) => ({
        id: '',
        informeId: '',
        area: a.area,
        observacion: a.observacion,
        valoracion: a.valoracion,
      })),
    };
    const result = await this.createUC.execute(input);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapInforme(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async list(
    @Query('salaId') salaId?: string,
    @Query('studentId') studentId?: string,
    @Query('periodo') periodo?: string,
  ) {
    const result = await this.listUC.execute({ salaId, studentId, periodo });
    return { data: result.unwrap().map((i) => this.mapInforme(i)) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async get(@Param('id') id: string) {
    const result = await this.getUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapInforme(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'REPORTS', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInformeSchema)) body: UpdateInformeDTO,
  ) {
    const input = {
      periodo: body.periodo,
      fecha: body.fecha ?? undefined,
      observacionesGenerales: body.observacionesGenerales ?? undefined,
      areas: body.areas?.map((a) => ({
        id: '',
        informeId: id,
        area: a.area,
        observacion: a.observacion,
        valoracion: a.valoracion,
      })),
    };
    const result = await this.updateUC.execute(id, input);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapInforme(result.unwrap()) };
  }

  private mapInforme(informe: { id: { get(): string }; studentId: string; salaId: string; periodo: { get(): string }; fecha: Date; observacionesGenerales?: string; areas: Array<{ id: string; informeId: string; area: string; observacion: string; valoracion: string }> }) {
    return {
      id: informe.id.get(),
      studentId: informe.studentId,
      salaId: informe.salaId,
      periodo: informe.periodo.get(),
      fecha: informe.fecha,
      observacionesGenerales: informe.observacionesGenerales,
      areas: informe.areas,
    };
  }
}
