/**
 * PR5-T6 [GREEN] — MateriasPreviasController.
 *
 * Endpoints:
 *   POST   /students/:studentId/materias-previas  → UpsertMateriaPrevia (201)
 *   GET    /students/:studentId/materias-previas  → ListMateriasPreviasByStudent (200)
 *
 * Response envelope: { data } for success.
 * Error mapping: NotFoundError → 404, ValidationError → 400.
 * Auth: GRADES / READ or WRITE (matches existing grading security model).
 *
 * Specs: MP-R1, MP-R6, MP-R8, MP-R9, D2
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotFoundError } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  UpsertMateriaPreviaSchema,
  UpsertMateriaPreviaDto,
  MateriaPreviaResponseDto,
} from './dto/materias-previas.dto';
import { UpsertMateriaPreviaUseCase } from '../../application/secundario/upsert-materia-previa.use-case';
import { ListMateriasPreviasByStudentUseCase } from '../../application/secundario/list-materias-previas-by-student.use-case';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class MateriasPreviasController {
  constructor(
    private readonly upsertUC: UpsertMateriaPreviaUseCase,
    private readonly listUC: ListMateriasPreviasByStudentUseCase,
  ) {}

  /**
   * POST /students/:studentId/materias-previas
   * Creates or updates a materia previa for a student.
   * Returns 201 { data } on success.
   * 400 if condicion=REGULAR (domain invariant).
   * 404 if studentId or subjectId not found in tenant.
   */
  @Post(':studentId/materias-previas')
  @HttpCode(201)
  @Roles({ module: 'GRADES', action: 'WRITE' })
  async create(
    @Param('studentId') studentId: string,
    @Body(new ZodValidationPipe(UpsertMateriaPreviaSchema))
    body: UpsertMateriaPreviaDto,
  ): Promise<{ data: MateriaPreviaResponseDto }> {
    const result = await this.upsertUC.execute({
      studentId,
      subjectId: body.subjectId,
      originAcademicYear: body.originAcademicYear,
      condicion: body.condicion,
      originCourseCycleId: body.originCourseCycleId,
    });

    if (result.isErr()) {
      const error = result.unwrapErr();
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }

    const entity = result.unwrap();
    return {
      data: {
        id: entity.id,
        studentId: entity.studentId,
        subjectId: entity.subjectId,
        originAcademicYear: entity.originAcademicYear,
        originCourseCycleId: entity.originCourseCycleId,
        condicion: entity.condicion,
        status: entity.status,
        resolvedGradeCode: entity.resolvedGradeCode,
        resolvedAt: entity.resolvedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
    };
  }

  /**
   * GET /students/:studentId/materias-previas
   * Lists materias previas for a student (all years or filtered by ?academicYear).
   * Returns 200 { data: [...] }.
   * 404 if studentId not found / cross-tenant.
   */
  @Get(':studentId/materias-previas')
  @Roles({ module: 'GRADES', action: 'READ' })
  async list(
    @CurrentUser() _user: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query('academicYear') academicYear?: string,
  ): Promise<{ data: MateriaPreviaResponseDto[] }> {
    const result = await this.listUC.execute({
      studentId,
      academicYear,
    });

    if (result.isErr()) {
      const error = result.unwrapErr();
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }

    const projections = result.unwrap();
    return {
      data: projections.map((p) => ({
        id: p.id,
        studentId: p.studentId,
        subjectId: p.subjectId,
        originAcademicYear: p.originAcademicYear,
        originCourseCycleId: p.originCourseCycleId,
        condicion: p.condicion,
        status: p.status,
        resolvedGradeCode: p.resolvedGradeCode,
        resolvedAt: p.resolvedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }
}
