import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  AddStudentToMateriaSchema,
  AddStudentToMateriaDto,
  CreateGrupoSchema,
  CreateGrupoDto,
  AddStudentToGrupoSchema,
  AddStudentToGrupoDto,
  type MateriaResponse,
  type GrupoResponse,
  type AlumnoXMateriaResponse,
  type AlumnoXGrupoResponse,
} from './dto/materia-grupo-ciclo.dto';
import { AddStudentToMateriaUseCase } from '../../application/materia-grupo-ciclo/add-student-to-materia.use-case';
import { CreateGrupoUseCase } from '../../application/materia-grupo-ciclo/create-grupo.use-case';
import { AddStudentToGrupoUseCase } from '../../application/materia-grupo-ciclo/add-student-to-grupo.use-case';
import { ListMateriasUseCase } from '../../application/materia-grupo-ciclo/list-materias.use-case';
import { ListGruposUseCase } from '../../application/materia-grupo-ciclo/list-grupos.use-case';

/**
 * MateriasGruposController — Fase 3c (F3-P1..P7).
 *
 * Nested under /course-cycles for materia-level endpoints, and under /grupos
 * for group-level student management.
 */
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class MateriasGruposController {
  constructor(
    private readonly listMateriasUC: ListMateriasUseCase,
    private readonly addStudentToMateriaUC: AddStudentToMateriaUseCase,
    private readonly createGrupoUC: CreateGrupoUseCase,
    private readonly listGruposUC: ListGruposUseCase,
    private readonly addStudentToGrupoUC: AddStudentToGrupoUseCase,
  ) {}

  /**
   * GET /course-cycles/:ccId/materias — F3-P2
   * Lists materias for a CursoXCiclo with alumno and grupo counts.
   */
  @Get('course-cycles/:ccId/materias')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listMaterias(@Param('ccId') ccId: string): Promise<{ data: MateriaResponse[] }> {
    const items = await this.listMateriasUC.execute(ccId);
    return {
      data: items.map((item) => ({
        id: item.materia.id,
        courseCycleId: item.materia.courseCycleId,
        subjectId: item.materia.subjectId,
        studyPlanSubjectId: item.materia.studyPlanSubjectId,
        alumnoCount: item.alumnoCount,
        grupoCount: item.grupoCount,
      })),
    };
  }

  /**
   * POST /course-cycles/:ccId/materias/:materiaId/alumnos — F3-P1
   * Adds a student to the universe of a materia.
   */
  @Post('course-cycles/:ccId/materias/:materiaId/alumnos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async addStudentToMateria(
    @Param('materiaId') materiaId: string,
    @Body(new ZodValidationPipe(AddStudentToMateriaSchema)) body: AddStudentToMateriaDto,
  ): Promise<{ data: AlumnoXMateriaResponse }> {
    const result = await this.addStudentToMateriaUC.execute({
      materiaXCursoXCicloId: materiaId,
      studentId: body.studentId,
    });
    return {
      data: {
        id: result.id,
        materiaXCursoXCicloId: result.materiaXCursoXCicloId,
        studentId: result.studentId,
      },
    };
  }

  /**
   * POST /course-cycles/:ccId/materias/:materiaId/grupos — F3-P3
   * Creates a group for a materia, assigning a docente.
   */
  @Post('course-cycles/:ccId/materias/:materiaId/grupos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async createGrupo(
    @Param('materiaId') materiaId: string,
    @Body(new ZodValidationPipe(CreateGrupoSchema)) body: CreateGrupoDto,
  ): Promise<{ data: GrupoResponse }> {
    const grupo = await this.createGrupoUC.execute({
      materiaXCursoXCicloId: materiaId,
      userId: body.userId,
      cycleId: body.cycleId,
      name: body.name,
    });
    return {
      data: {
        id: grupo.id,
        materiaXCursoXCicloId: grupo.materiaXCursoXCicloId,
        docenteXCicloId: grupo.docenteXCicloId,
        name: grupo.name,
        alumnoCount: 0, // freshly created
      },
    };
  }

  /**
   * GET /course-cycles/:ccId/materias/:materiaId/grupos — F3-P4
   * Lists groups of a materia with student counts.
   */
  @Get('course-cycles/:ccId/materias/:materiaId/grupos')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listGrupos(@Param('materiaId') materiaId: string): Promise<{ data: GrupoResponse[] }> {
    const items = await this.listGruposUC.execute(materiaId);
    return {
      data: items.map((item) => ({
        id: item.grupo.id,
        materiaXCursoXCicloId: item.grupo.materiaXCursoXCicloId,
        docenteXCicloId: item.grupo.docenteXCicloId,
        name: item.grupo.name,
        alumnoCount: item.alumnos.length,
      })),
    };
  }

  /**
   * POST /grupos/:grupoId/alumnos — F3-P5
   * Adds a student (via their AlumnosXMateria membership) to a group.
   */
  @Post('grupos/:grupoId/alumnos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async addStudentToGrupo(
    @Param('grupoId') grupoId: string,
    @Body(new ZodValidationPipe(AddStudentToGrupoSchema)) body: AddStudentToGrupoDto,
  ): Promise<{ data: AlumnoXGrupoResponse }> {
    const result = await this.addStudentToGrupoUC.execute({
      grupoId,
      alumnosXMateriaXCursoXCicloId: body.alumnosXMateriaXCursoXCicloId,
    });
    return {
      data: {
        id: result.id,
        grupoId: result.grupoId,
        alumnosXMateriaXCursoXCicloId: result.alumnosXMateriaXCursoXCicloId,
      },
    };
  }

  /**
   * GET /grupos/:grupoId/alumnos — F3-P6
   * Lists students of a group.
   */
  @Get('grupos/:grupoId/alumnos')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listAlumnosGrupo(
    @Param('grupoId') grupoId: string,
  ): Promise<{ data: AlumnoXGrupoResponse[] }> {
    const alumnos = await this.listGruposUC.getAlumnosForGrupo(grupoId);
    return {
      data: alumnos.map((a) => ({
        id: a.id,
        grupoId: a.grupoId,
        alumnosXMateriaXCursoXCicloId: a.alumnosXMateriaXCursoXCicloId,
      })),
    };
  }
}
