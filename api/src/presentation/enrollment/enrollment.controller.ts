import {
  Controller, Get, Post, Delete, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateEnrollmentSchema, CreateEnrollmentDTO } from './dto/create-enrollment.dto';
import { ToggleFlagSchema, ToggleFlagDTO } from './dto/toggle-flag.dto';
import { BulkToggleSchema, BulkToggleDTO } from './dto/bulk-toggle.dto';
import {
  CreateEnrollmentUseCase, ListEnrollmentsUseCase, GetEnrollmentUseCase, DeleteEnrollmentUseCase,
  ToggleEnrollmentFlagUseCase, BulkToggleEnrollmentFlagsUseCase,
} from '../../application/enrollment/use-cases/enrollment.use-cases';

@Controller('enrollments')
@UseGuards(AuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(
    private readonly createUC: CreateEnrollmentUseCase,
    private readonly listUC: ListEnrollmentsUseCase,
    private readonly getUC: GetEnrollmentUseCase,
    private readonly deleteUC: DeleteEnrollmentUseCase,
    private readonly toggleFlagUC: ToggleEnrollmentFlagUseCase,
    private readonly bulkToggleUC: BulkToggleEnrollmentFlagsUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateEnrollmentSchema)) body: CreateEnrollmentDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const e = result.unwrap();
    return { data: { id: e.id.get(), level: e.level.toString(), academicYear: e.academicYear, status: e.status, cycleId: e.cycleId?.get() ?? null } };
  }

  @Get()
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'READ' })
  async list(@Query('studentId') studentId: string, @Query('institutionId') institutionId: string) {
    if (studentId) {
      const enrollments = await this.listUC.executeByStudent(studentId);
      return { data: enrollments.map(toDto) };
    }
    if (institutionId) {
      const enrollments = await this.listUC.executeByInstitution(institutionId);
      return { data: enrollments.map(toDto) };
    }
    return { data: [] };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'READ' })
  async get(@Param('id') id: string) {
    const e = await this.getUC.execute(id);
    if (!e) return { data: null };
    return { data: toDto(e) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }

  @Patch(':id/flags')
  @Roles('ADMIN', 'SECRETARIO', 'DIRECTOR')
  async toggleFlag(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ToggleFlagSchema)) body: ToggleFlagDTO,
  ) {
    const result = await this.toggleFlagUC.execute(id, body.flag);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Patch('course/:cycleId/flags')
  @Roles('ADMIN', 'SECRETARIO', 'DIRECTOR')
  async bulkToggleFlags(
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(BulkToggleSchema)) body: BulkToggleDTO,
  ) {
    const count = await this.bulkToggleUC.execute({
      cycleId,
      flag: body.flag,
      value: body.value,
      level: body.level,
      grade: body.grade,
      division: body.division,
      academicYear: body.academicYear,
    });
    return { data: { updated: count } };
  }
}

function toDto(e: { id: { get(): string }; studentId: { get(): string }; institutionId: { get(): string }; cycleId?: { get(): string }; level: { toString(): string }; academicYear: string; grade?: string; division?: string; status: { toString(): string }; enrolledAt: Date; printable: boolean; promoted: boolean }) {
  return { id: e.id.get(), studentId: e.studentId.get(), institutionId: e.institutionId.get(), cycleId: e.cycleId?.get() ?? null, level: e.level.toString(), academicYear: e.academicYear, grade: e.grade, division: e.division, status: e.status.toString(), enrolledAt: e.enrolledAt.toISOString(), printable: e.printable, promoted: e.promoted };
}
