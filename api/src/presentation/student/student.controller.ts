import {
  Controller, Get, Post, Delete, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, Query, Inject,
  ConflictException, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import type { StudentRepository } from '@educandow/domain';
import { NotFoundError, ValidationError, DomainError, ForbiddenError } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateStudentSchema, CreateStudentDTO } from './dto/create-student.dto';
import { UpdateStudentSchema, UpdateStudentDTO } from './dto/update-student.dto';
import { AssignGuardianSchema, AssignGuardianDTO } from './dto/assign-guardian.dto';
import { UpdateGuardianSchema, UpdateGuardianDTO } from './dto/update-guardian.dto';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
  CreateStudyTutorUseCase, UpdateStudyTutorUseCase,
  toGuardianOutput,
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
    private readonly listGuardiansUC: ListGuardiansUseCase,
    private readonly createStudyTutorUC: CreateStudyTutorUseCase,
    private readonly updateStudyTutorUC: UpdateStudyTutorUseCase,
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
  @Roles('ROOT', { module: 'STUDENTS', action: 'READ' })
  async search(@Query('q') q: string, @Query('institutionId') institutionId: string) {
    if (!q) return { data: [] };
    const students = await this.studentRepo.search(institutionId, q);
    return { data: students.map((s) => this.mapStudent(s)) };
  }

  // ── CRUD routes ───────────────────────────────────────────

  @Post()
  @Roles('ROOT', { module: 'STUDENTS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateStudentSchema)) body: CreateStudentDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    const s = result.unwrap();
    return { data: { id: s.id.get(), firstName: s.firstName, lastName: s.lastName, dni: s.dni.get() } };
  }

  @Patch(':id')
  @Roles({ module: 'STUDENTS', action: 'READ' })
  async patch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStudentSchema)) body: UpdateStudentDTO,
    @CurrentUser() user: { userId: string; roles: string[] },
  ) {
    const updated = await this.patchUC.execute(id, body as Record<string, unknown>, { userId: user.userId, roles: user.roles });
    return { data: this.mapStudent(updated) };
  }

  @Get()
  @Roles('ROOT', { module: 'STUDENTS', action: 'READ' })
  async list(
    @Query('institutionId') institutionId: string,
    @CurrentUser() user: { userId: string; roles: string[] },
  ) {
    const students = await this.listUC.execute(institutionId, { userId: user.userId, roles: user.roles });
    return { data: students.map((s) => this.mapStudent(s)) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'STUDENTS', action: 'READ' })
  async get(@Param('id') id: string) {
    const s = await this.getUC.execute(id);
    if (!s) return { data: null };
    return { data: this.mapStudent(s) };
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'STUDENTS', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }

  // ── Guardian routes ───────────────────────────────────────

  @Get(':id/guardians')
  @Roles('ROOT', { module: 'STUDENTS', action: 'READ' })
  async listGuardians(@Param('id') id: string) {
    const guardians = await this.listGuardiansUC.execute(id);
    return { data: guardians };
  }

  @Post(':id/guardians')
  @Roles('ROOT', { module: 'STUDENTS', action: 'UPDATE' })
  @HttpCode(HttpStatus.CREATED)
  async assignOrCreateGuardian(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignGuardianSchema)) body: AssignGuardianDTO,
  ) {
    if (body.userId) {
      // Portal-link path: AssignGuardianUseCase (userId present)
      // Bug 4 fix: also forward fullName/mobile/email typed by the user
      // Fix #7 (round-3): forward active so portal-link with active:false is persisted correctly
      const result = await this.assignGuardianUC.execute(id, {
        userId: body.userId,
        relationship: body.relationship,
        fullName: body.fullName,
        mobile: body.mobile,
        email: body.email,
        active: body.active,
        isFinancialResponsible: body.isFinancialResponsible,
        isAuthorizedToPickUp: body.isAuthorizedToPickUp,
      });
      if (result.isErr()) {
        this.throwGuardianError(result.unwrapErr());
      }
      return { data: toGuardianOutput(result.unwrap()) };
    } else {
      // Study-tutor path: CreateStudyTutorUseCase (no userId)
      const result = await this.createStudyTutorUC.execute({
        studentId: id,
        fullName: body.fullName ?? '',
        mobile: body.mobile ?? '',
        relationship: body.relationship,
        email: body.email,
        active: body.active,
        isFinancialResponsible: body.isFinancialResponsible,
        isAuthorizedToPickUp: body.isAuthorizedToPickUp,
        allowDuplicate: body.allowDuplicate,
      });
      if (result.isErr()) {
        this.throwGuardianError(result.unwrapErr());
      }
      return { data: toGuardianOutput(result.unwrap()) };
    }
  }

  @Patch(':id/guardians/:guardianId')
  @Roles('ROOT', { module: 'STUDENTS', action: 'UPDATE' })
  async updateGuardian(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body(new ZodValidationPipe(UpdateGuardianSchema)) body: UpdateGuardianDTO,
  ) {
    // Bug 1 fix: pass studentId so the use case can verify ownership
    const result = await this.updateStudyTutorUC.execute({ studentId, guardianId, ...body });
    if (result.isErr()) {
      this.throwGuardianError(result.unwrapErr());
    }
    return { data: toGuardianOutput(result.unwrap()) };
  }

  @Delete(':id/guardians/:guardianId')
  @Roles('ROOT', { module: 'STUDENTS', action: 'UPDATE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeGuardian(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
  ) {
    // Round4-Bug1: pass studentId so the use case can verify ownership (mirrors PATCH fix)
    try {
      await this.removeGuardianUC.execute(guardianId, studentId);
    } catch (e) {
      this.throwGuardianError(e as Error);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Map KNOWN domain errors from guardian use cases to HTTP exceptions.
   * Round5-Bug3 fix: unknown/infra errors are re-thrown as-is so the global
   * AppExceptionFilter maps them to 500 (and logs them). Only domain-layer errors
   * are converted to 400/404/409 — never infra exceptions.
   */
  private throwGuardianError(error: Error): never {
    const msg = error.message;
    if (msg === 'GUARDIAN_ALREADY_ASSIGNED' || msg === 'TUTOR_DUPLICATE_NAME') {
      throw new ConflictException(msg);
    }
    if (error instanceof NotFoundError || msg === 'GUARDIAN_NOT_FOUND') {
      throw new NotFoundException(msg);
    }
    if (error instanceof ForbiddenError) {
      throw new ForbiddenException(msg);
    }
    if (error instanceof ValidationError || error instanceof DomainError) {
      throw new BadRequestException(msg);
    }
    // Unknown/infra error — re-throw so AppExceptionFilter handles it as 500
    throw error;
  }

  private mapStudent(s: { id: { get(): string }; firstName: string; lastName: string; dni: { get(): string }; fullName: string; email?: { get(): string } | undefined; birthDate?: Date; guardianName?: string; guardianPhone?: string; motherName?: string; fatherDni?: string; motherDni?: string; fatherEmail?: { get(): string } | undefined; motherEmail?: { get(): string } | undefined; address?: string; phone?: string; photoUrl?: string; institutionId?: { get(): string } | string }) {
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
      fatherEmail: s.fatherEmail?.get?.() ?? null,
      motherEmail: s.motherEmail?.get?.() ?? null,
      address: s.address,
      phone: s.phone,
      photoUrl: s.photoUrl,
      institutionId: typeof s.institutionId === 'string' ? s.institutionId : s.institutionId?.get?.() ?? '',
    };
  }
}
