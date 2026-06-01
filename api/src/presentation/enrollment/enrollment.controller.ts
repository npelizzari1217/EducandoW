import {
  Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateEnrollmentSchema, CreateEnrollmentDTO } from './dto/create-enrollment.dto';
import {
  CreateEnrollmentUseCase, ListEnrollmentsUseCase, GetEnrollmentUseCase, DeleteEnrollmentUseCase,
} from '../../application/enrollment/use-cases/enrollment.use-cases';

@Controller('enrollments')
@UseGuards(AuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(
    private readonly createUC: CreateEnrollmentUseCase,
    private readonly listUC: ListEnrollmentsUseCase,
    private readonly getUC: GetEnrollmentUseCase,
    private readonly deleteUC: DeleteEnrollmentUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateEnrollmentSchema)) body: CreateEnrollmentDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const e = result.unwrap();
    return { data: { id: e.id.get(), level: e.level.toString(), academicYear: e.academicYear, status: e.status } };
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
}

function toDto(e: { id: { get(): string }; studentId: { get(): string }; institutionId: { get(): string }; level: { toString(): string }; academicYear: string; grade?: string; division?: string; status: string; enrolledAt: Date }) {
  return { id: e.id.get(), studentId: e.studentId.get(), institutionId: e.institutionId.get(), level: e.level.toString(), academicYear: e.academicYear, grade: e.grade, division: e.division, status: e.status, enrolledAt: e.enrolledAt.toISOString() };
}
