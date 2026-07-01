import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Res,
  HttpCode, HttpStatus, UseGuards, Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateAttendanceTypeSchema, CreateAttendanceTypeDTO } from './dto/create-attendance-type.dto';
import { UpdateAttendanceTypeSchema, UpdateAttendanceTypeDTO } from './dto/update-attendance-type.dto';
import { PrintAttendanceTypesQuerySchema, PrintAttendanceTypesDTO } from './dto/print-attendance-types.dto';
import {
  CreateAttendanceTypeUseCase,
  UpdateAttendanceTypeUseCase,
  DeleteAttendanceTypeUseCase,
  ListAttendanceTypesUseCase,
  GetAttendanceTypeUseCase,
} from '../../application/attendance-type/use-cases/attendance-type.use-cases';
import { GenerateAttendanceTypesPdfUseCase } from '../../application/attendance-type/use-cases/generate-attendance-types-pdf.use-case';
import type { AttendanceType } from '@educandow/domain';

function toResponse(entity: AttendanceType) {
  return {
    id: entity.id,
    code: entity.code.get(),
    description: entity.description,
    absence_value: entity.absenceValue,
    level: entity.level,
    behavior: entity.behavior.get(),
    assignable: entity.assignable, // derived (ADR-03), kept for backward compat
    is_system: entity.isSystem,
    active: entity.active,
  };
}

@Controller('attendance-types')
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceTypeController {
  constructor(
    @Inject(CreateAttendanceTypeUseCase) private readonly createUC: CreateAttendanceTypeUseCase,
    @Inject(ListAttendanceTypesUseCase) private readonly listUC: ListAttendanceTypesUseCase,
    @Inject(GetAttendanceTypeUseCase) private readonly getUC: GetAttendanceTypeUseCase,
    @Inject(UpdateAttendanceTypeUseCase) private readonly updateUC: UpdateAttendanceTypeUseCase,
    @Inject(DeleteAttendanceTypeUseCase) private readonly deleteUC: DeleteAttendanceTypeUseCase,
    @Inject(GenerateAttendanceTypesPdfUseCase) private readonly generatePdfUC: GenerateAttendanceTypesPdfUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'CREATE' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateAttendanceTypeSchema)) body: CreateAttendanceTypeDTO,
  ) {
    const result = await this.createUC.execute({
      code: body.code,
      description: body.description,
      absenceValue: body.absenceValue,
      level: body.level,
      behavior: body.behavior,
      active: body.active,
    }, user);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'READ' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('level') level?: string,
    @Query('active') active?: string,
  ) {
    const filters: { level?: number; active?: boolean } = {};
    if (level !== undefined) filters.level = Number(level);
    if (active === 'true') filters.active = true;
    else if (active === 'false') filters.active = false;

    const entities = await this.listUC.execute(Object.keys(filters).length ? filters : undefined, user);
    return { data: entities.map(toResponse) };
  }

  // NOTE: this route MUST be declared BEFORE `GET :id` — Nest matches routes in
  // declaration order for the same HTTP method/prefix, so `/print` would otherwise
  // be swallowed by `:id` (id='print'). See design.md §3.4 / tasks.md T28 (PR4).
  @Get('print')
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'READ' })
  async printList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(PrintAttendanceTypesQuerySchema)) query: PrintAttendanceTypesDTO,
    @Res() res: Response,
  ): Promise<void> {
    const pdfBuffer = await this.generatePdfUC.execute({
      level: query.level,
      active: query.active,
      currentUser: user,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="tipos-asistencia.pdf"',
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  @Get(':id')
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'READ' })
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.getUC.execute(id, user);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'UPDATE' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAttendanceTypeSchema)) body: UpdateAttendanceTypeDTO,
  ) {
    const result = await this.updateUC.execute(id, body, user);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'ATTENDANCE_TYPES', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.deleteUC.execute(id, user);
    if (result.isErr()) throw result.unwrapErr();
    return;
  }
}
