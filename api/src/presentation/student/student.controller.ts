import {
  Controller, Get, Post, Delete, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, Query, Inject,
} from '@nestjs/common';
import type { StudentRepository } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateStudentSchema, CreateStudentDTO } from './dto/create-student.dto';
import { UpdateStudentSchema, UpdateStudentDTO } from './dto/update-student.dto';
import { AssignGuardianSchema, AssignGuardianDTO } from './dto/assign-guardian.dto';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase,
} from '../../application/student/use-cases/student.use-cases';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly createUC: CreateStudentUseCase,
    private readonly listUC: ListStudentsUseCase,
    private readonly getUC: GetStudentUseCase,
    private readonly deleteUC: DeleteStudentUseCase,
    private readonly patchUC: PatchStudentUseCase,
    private readonly myDataUC: GetMyStudentDataUseCase,
    private readonly myChildrenUC: GetMyChildrenUseCase,
    private readonly assignGuardianUC: AssignGuardianUseCase,
    private readonly removeGuardianUC: RemoveGuardianUseCase,
    @Inject('StudentRepository') private readonly studentRepo: StudentRepository,
  ) {}

  // ── Literal routes MUST come before /:id ──────────────────

  @Get('me')
  @Roles({ module: 'STUDENTS', action: 'READ' })
  async me(@CurrentUser() user: { userId: string; roles: string[] }) {
    const student = await this.myDataUC.execute(user.userId);
    return { data: this.mapStudent(student) };
  }

  @Get('my-children')
  @Roles({ module: 'STUDENTS', action: 'READ' })
  async myChildren(@CurrentUser() user: { userId: string; roles: string[] }) {
    const students = await this.myChildrenUC.execute(user.userId);
    return { data: students.map((s) => this.mapStudent(s)) };
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async search(@Query('q') q: string, @Query('institutionId') institutionId: string) {
    if (!q) return { data: [] };
    const students = await this.studentRepo.search(institutionId, q);
    return { data: students.map((s) => this.mapStudent(s)) };
  }

  // ── CRUD routes ───────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body(new ZodValidationPipe(CreateStudentSchema)) body: CreateStudentDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const s = result.unwrap();
    return { data: { id: s.id.get(), firstName: s.firstName, lastName: s.lastName, dni: s.dni.get() } };
  }

  @Patch(':id')
  @Roles({ module: 'STUDENTS', action: 'UPDATE' }, { module: 'STUDENTS', action: 'READ' })
  async patch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStudentSchema)) body: UpdateStudentDTO,
    @CurrentUser() user: { userId: string; roles: string[] },
  ) {
    const updated = await this.patchUC.execute(id, body as Record<string, unknown>, { userId: user.userId, roles: user.roles });
    return { data: this.mapStudent(updated) };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async list(@Query('institutionId') institutionId: string) {
    const students = await this.listUC.execute(institutionId);
    return { data: students.map((s) => this.mapStudent(s)) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async get(@Param('id') id: string) {
    const s = await this.getUC.execute(id);
    if (!s) return { data: null };
    return { data: this.mapStudent(s) };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }

  // ── Guardian routes ───────────────────────────────────────

  @Post(':id/guardians')
  @Roles('ROOT', 'ADMIN')
  async assignGuardian(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignGuardianSchema)) body: AssignGuardianDTO,
  ) {
    await this.assignGuardianUC.execute(id, body);
    return { data: { message: 'Guardian assigned' } };
  }

  @Delete(':id/guardians/:guardianId')
  @Roles('ROOT', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeGuardian(
    @Param('id') _id: string,
    @Param('guardianId') guardianId: string,
  ) {
    await this.removeGuardianUC.execute(guardianId);
  }

  // ── Helper ─────────────────────────────────────────────────

  private mapStudent(s: { id: { get(): string }; firstName: string; lastName: string; dni: { get(): string }; fullName: string; email?: { get(): string } | undefined; birthDate?: Date; guardianName?: string; guardianPhone?: string; motherName?: string; fatherDni?: string; motherDni?: string; address?: string; phone?: string; photoUrl?: string; institutionId: string }) {
    return {
      id: s.id.get(),
      firstName: s.firstName,
      lastName: s.lastName,
      dni: s.dni.get(),
      fullName: s.fullName,
      email: s.email?.get?.(),
      birthDate: s.birthDate?.toISOString?.() ?? s.birthDate,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      motherName: s.motherName,
      fatherDni: s.fatherDni,
      motherDni: s.motherDni,
      address: s.address,
      phone: s.phone,
      photoUrl: s.photoUrl,
      institutionId: s.institutionId,
    };
  }
}
