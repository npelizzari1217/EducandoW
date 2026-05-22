import {
  Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateTeacherSchema, CreateTeacherDTO } from './dto/create-teacher.dto';
import {
  CreateTeacherUseCase, ListTeachersUseCase, GetTeacherUseCase, DeleteTeacherUseCase,
} from '../../application/teacher/use-cases/teacher.use-cases';

@Controller('teachers')
@UseGuards(AuthGuard, RolesGuard)
export class TeacherController {
  constructor(
    private readonly createUC: CreateTeacherUseCase,
    private readonly listUC: ListTeachersUseCase,
    private readonly getUC: GetTeacherUseCase,
    private readonly deleteUC: DeleteTeacherUseCase,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreateTeacherSchema)) body: CreateTeacherDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const t = result.unwrap();
    return { data: { id: t.id.get(), firstName: t.firstName, lastName: t.lastName, email: t.email.get() } };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async list(@Query('institutionId') institutionId: string) {
    const teachers = await this.listUC.execute(institutionId);
    return { data: teachers.map((t: { id: { get(): string }; firstName: string; lastName: string; dni: { get(): string }; email: { get(): string }; fullName: string }) => ({ id: t.id.get(), firstName: t.firstName, lastName: t.lastName, dni: t.dni.get(), email: t.email.get(), fullName: t.fullName })) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async get(@Param('id') id: string) {
    const t = await this.getUC.execute(id);
    if (!t) return { data: null };
    return { data: { id: t.id.get(), firstName: t.firstName, lastName: t.lastName, dni: t.dni.get(), email: t.email.get(), phone: t.phone, title: t.title, institutionId: t.institutionId } };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }
}
