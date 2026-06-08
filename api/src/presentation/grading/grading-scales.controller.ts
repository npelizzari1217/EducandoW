import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateGradeScaleSchema, CreateGradeScaleDTO } from './dto/create-grade-scale.dto';
import { UpdateGradeScaleSchema, UpdateGradeScaleDTO } from './dto/update-grade-scale.dto';
import { CreateGradeScaleValueSchema, CreateGradeScaleValueDTO } from './dto/create-grade-scale-value.dto';
import { UpdateGradeScaleValueSchema, UpdateGradeScaleValueDTO } from './dto/update-grade-scale-value.dto';
import {
  CreateGradeScaleUseCase,
  UpdateGradeScaleUseCase,
  DeleteGradeScaleUseCase,
  ListGradeScalesUseCase,
  GetGradeScaleUseCase,
} from '../../application/grading/use-cases/grade-scale.use-cases';
import {
  CreateGradeScaleValueUseCase,
  UpdateGradeScaleValueUseCase,
  DeleteGradeScaleValueUseCase,
} from '../../application/grading/use-cases/grade-scale-value.use-cases';
import type { GradeScale, GradeScaleValue } from '@educandow/domain';

// ── Response helpers ──────────────────────────────────────────

function toValueResponse(v: GradeScaleValue) {
  return {
    id: v.id,
    scale_id: v.scaleId,
    code: v.code,
    label: v.label,
    internal_status: v.internalStatus,
    sort_order: v.sortOrder,
    active: v.active,
  };
}

function toResponse(scale: GradeScale) {
  return {
    id: scale.id,
    name: scale.name,
    level: scale.level,
    modality: scale.modality,
    active: scale.active,
    values: scale.values.map(toValueResponse),
  };
}

// ── Controller ────────────────────────────────────────────────

@Controller('grading/scales')
@UseGuards(AuthGuard, RolesGuard)
export class GradingScalesController {
  constructor(
    private readonly createUC: CreateGradeScaleUseCase,
    private readonly listUC: ListGradeScalesUseCase,
    private readonly getUC: GetGradeScaleUseCase,
    private readonly updateUC: UpdateGradeScaleUseCase,
    private readonly deleteUC: DeleteGradeScaleUseCase,
    private readonly createValueUC: CreateGradeScaleValueUseCase,
    private readonly updateValueUC: UpdateGradeScaleValueUseCase,
    private readonly deleteValueUC: DeleteGradeScaleValueUseCase,
  ) {}

  // ── Scale CRUD ─────────────────────────────────────────────

  @Post()
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'CREATE' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateGradeScaleSchema)) body: CreateGradeScaleDTO,
  ) {
    const result = await this.createUC.execute({
      name: body.name,
      level: body.level,
      modality: body.modality,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'READ' })
  async list(
    @Query('level') level?: string,
    @Query('modality') modality?: string,
  ) {
    const filters: { level?: number; modality?: number } = {};
    if (level !== undefined) filters.level = Number(level);
    if (modality !== undefined) filters.modality = Number(modality);

    const entities = await this.listUC.execute(
      Object.keys(filters).length ? filters : undefined,
    );
    return { data: entities.map(toResponse) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'READ' })
  async getOne(@Param('id') id: string) {
    const result = await this.getUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateGradeScaleSchema)) body: UpdateGradeScaleDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const result = await this.deleteUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return;
  }

  // ── Value CRUD ─────────────────────────────────────────────

  @Post(':id/values')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'CREATE' })
  @HttpCode(HttpStatus.CREATED)
  async createValue(
    @Param('id') scaleId: string,
    @Body(new ZodValidationPipe(CreateGradeScaleValueSchema)) body: CreateGradeScaleValueDTO,
  ) {
    const result = await this.createValueUC.execute({
      scaleId,
      code: body.code,
      label: body.label,
      internalStatus: body.internalStatus,
      sortOrder: body.sortOrder,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toValueResponse(result.unwrap()) };
  }

  @Patch(':id/values/:valueId')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'UPDATE' })
  async updateValue(
    @Param('id') _scaleId: string,
    @Param('valueId') valueId: string,
    @Body(new ZodValidationPipe(UpdateGradeScaleValueSchema)) body: UpdateGradeScaleValueDTO,
  ) {
    const result = await this.updateValueUC.execute(valueId, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toValueResponse(result.unwrap()) };
  }

  @Delete(':id/values/:valueId')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeValue(
    @Param('id') _scaleId: string,
    @Param('valueId') valueId: string,
  ) {
    const result = await this.deleteValueUC.execute(valueId);
    if (result.isErr()) throw result.unwrapErr();
    return;
  }
}
