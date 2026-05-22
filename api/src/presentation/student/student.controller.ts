import {
  Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateStudentSchema, CreateStudentDTO } from './dto/create-student.dto';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
} from '../../application/student/use-cases/student.use-cases';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly createUC: CreateStudentUseCase,
    private readonly listUC: ListStudentsUseCase,
    private readonly getUC: GetStudentUseCase,
    private readonly deleteUC: DeleteStudentUseCase,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreateStudentSchema)) body: CreateStudentDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const s = result.unwrap();
    return { data: { id: s.id.get(), firstName: s.firstName, lastName: s.lastName, dni: s.dni.get() } };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async list(@Query('institutionId') institutionId: string) {
    const students = await this.listUC.execute(institutionId);
    return { data: students.map((s: { id: { get(): string }; firstName: string; lastName: string; dni: { get(): string }; fullName: string }) => ({ id: s.id.get(), firstName: s.firstName, lastName: s.lastName, dni: s.dni.get(), fullName: s.fullName })) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async get(@Param('id') id: string) {
    const s = await this.getUC.execute(id);
    if (!s) return { data: null };
    return { data: { id: s.id.get(), firstName: s.firstName, lastName: s.lastName, dni: s.dni.get(), email: s.email?.get(), birthDate: s.birthDate?.toISOString(), guardianName: s.guardianName, guardianPhone: s.guardianPhone, institutionId: s.institutionId } };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }
}
