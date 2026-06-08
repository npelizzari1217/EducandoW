import {
  Controller, Get, Post, Patch, Put, Delete,
  Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreatePeriodTemplateSchema, CreatePeriodTemplateDTO } from './dto/create-period-template.dto';
import { UpdatePeriodTemplateSchema, UpdatePeriodTemplateDTO } from './dto/update-period-template.dto';
import { UpsertPeriodDatesSchema, UpsertPeriodDatesDTO } from './dto/upsert-period-dates.dto';
import {
  CreateGradingPeriodTemplateUseCase,
  UpdateGradingPeriodTemplateUseCase,
  DeleteGradingPeriodTemplateUseCase,
  ListGradingPeriodTemplatesUseCase,
  GetGradingPeriodTemplateUseCase,
} from '../../application/grading/use-cases/grading-period-template.use-cases';
import {
  UpsertPeriodDatesUseCase,
  ListPeriodDatesUseCase,
} from '../../application/grading/use-cases/grading-period-date.use-cases';
import type { GradingPeriodTemplate, GradingPeriodDate } from '@educandow/domain';

// ── Response helpers ──────────────────────────────────────────

function toItemResponse(item: { id: string; name: string; sortOrder: number }) {
  return {
    id: item.id,
    name: item.name,
    sort_order: item.sortOrder,
  };
}

function toTemplateResponse(template: GradingPeriodTemplate) {
  return {
    id: template.id,
    name: template.name,
    level: template.level,
    modality: template.modality,
    active: template.active,
    items: template.items.map(toItemResponse),
  };
}

function toDateResponse(date: GradingPeriodDate) {
  return {
    id: date.id,
    item_id: date.itemId,
    cycle_id: date.cycleId,
    start_date: date.startDate,
    end_date: date.endDate,
  };
}

// ── Controller ────────────────────────────────────────────────

@Controller('grading/period-templates')
@UseGuards(AuthGuard, RolesGuard)
export class GradingPeriodsController {
  constructor(
    private readonly createTemplateUC: CreateGradingPeriodTemplateUseCase,
    private readonly listTemplatesUC: ListGradingPeriodTemplatesUseCase,
    private readonly getTemplateUC: GetGradingPeriodTemplateUseCase,
    private readonly updateTemplateUC: UpdateGradingPeriodTemplateUseCase,
    private readonly deleteTemplateUC: DeleteGradingPeriodTemplateUseCase,
    private readonly upsertDatesUC: UpsertPeriodDatesUseCase,
    private readonly listDatesUC: ListPeriodDatesUseCase,
  ) {}

  // ── Template CRUD ──────────────────────────────────────────

  @Post()
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'CREATE' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreatePeriodTemplateSchema)) body: CreatePeriodTemplateDTO,
  ) {
    const result = await this.createTemplateUC.execute({
      name: body.name,
      level: body.level,
      modality: body.modality,
      items: body.items,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toTemplateResponse(result.unwrap()) };
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

    const entities = await this.listTemplatesUC.execute(
      Object.keys(filters).length ? filters : undefined,
    );
    return { data: entities.map(toTemplateResponse) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'READ' })
  async getOne(@Param('id') id: string) {
    const result = await this.getTemplateUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toTemplateResponse(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePeriodTemplateSchema)) body: UpdatePeriodTemplateDTO,
  ) {
    const result = await this.updateTemplateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toTemplateResponse(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const result = await this.deleteTemplateUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return;
  }

  // ── Dates CRUD ─────────────────────────────────────────────

  @Get(':id/dates')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'READ' })
  async listDates(
    @Param('id') templateId: string,
    @Query('cycleId') cycleId: string,
  ) {
    const dates = await this.listDatesUC.execute(templateId, cycleId);
    return { data: dates.map(toDateResponse) };
  }

  @Put(':id/dates')
  @Roles('ROOT', { module: 'GRADING_CONFIG', action: 'UPDATE' })
  async upsertDates(
    @Param('id') templateId: string,
    @Body(new ZodValidationPipe(UpsertPeriodDatesSchema)) body: UpsertPeriodDatesDTO,
  ) {
    const result = await this.upsertDatesUC.execute(
      templateId,
      body.cycleId,
      body.dates,
    );
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map(toDateResponse) };
  }
}
