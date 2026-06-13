import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
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
  type AlumnoMateriaItem,
} from './dto/materia-grupo-ciclo.dto';
import { AddStudentToMateriaUseCase } from '../../application/materia-grupo-ciclo/add-student-to-materia.use-case';
import { CreateGrupoUseCase } from '../../application/materia-grupo-ciclo/create-grupo.use-case';
import { AddStudentToGrupoUseCase } from '../../application/materia-grupo-ciclo/add-student-to-grupo.use-case';
import { ListMateriasUseCase } from '../../application/materia-grupo-ciclo/list-materias.use-case';
import { ListGruposUseCase } from '../../application/materia-grupo-ciclo/list-grupos.use-case';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

/**
 * MateriasGruposController — Fase 3c (F3-P1..P7) + F7 enrichment.
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
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * GET /course-cycles/:ccId/materias — F3-P2
   * Lists materias for a CursoXCiclo with alumno and grupo counts + subjectName.
   */
  @Get('course-cycles/:ccId/materias')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listMaterias(@Param('ccId') ccId: string): Promise<{ data: MateriaResponse[] }> {
    const items = await this.listMateriasUC.execute(ccId);
    const client = TenantContext.getClient();
    const subjectIds = items.map((i) => i.materia.subjectId);
    let subjectMap = new Map<string, string>();
    if (client && subjectIds.length) {
      const subjects = await client.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
      });
      subjectMap = new Map(
        subjects.map((s: { id: string; name: string }) => [s.id, s.name]),
      );
    }
    return {
      data: items.map((item) => ({
        id: item.materia.id,
        courseCycleId: item.materia.courseCycleId,
        subjectId: item.materia.subjectId,
        studyPlanSubjectId: item.materia.studyPlanSubjectId,
        subjectName: subjectMap.get(item.materia.subjectId) ?? item.materia.subjectId,
        alumnosCount: item.alumnoCount,
        gruposCount: item.grupoCount,
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
   * cycleId is optional in the body; when absent, resolved from CourseCycle.
   */
  @Post('course-cycles/:ccId/materias/:materiaId/grupos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async createGrupo(
    @Param('ccId') ccId: string,
    @Param('materiaId') materiaId: string,
    @Body(new ZodValidationPipe(CreateGrupoSchema)) body: CreateGrupoDto,
  ): Promise<{ data: GrupoResponse }> {
    let cycleId = body.cycleId;
    if (!cycleId) {
      const client = TenantContext.getClient();
      if (!client) throw new NotFoundException(`No tenant client available`);
      const cc = await client.courseCycle.findUnique({
        where: { uuid: ccId },
        select: { cycleId: true },
      });
      if (!cc) throw new NotFoundException(`CourseCycle ${ccId} not found`);
      cycleId = cc.cycleId;
    }

    const grupo = await this.createGrupoUC.execute({
      materiaXCursoXCicloId: materiaId,
      userId: body.userId,
      cycleId,
      name: body.name,
    });
    return {
      data: {
        id: grupo.id,
        materiaXCursoXCicloId: grupo.materiaXCursoXCicloId,
        docenteXCicloId: grupo.docenteXCicloId,
        name: grupo.name,
        alumnosCount: 0, // freshly created
        userId: body.userId,
        docenteName: null, // not resolved at creation time
      },
    };
  }

  /**
   * GET /course-cycles/:ccId/materias/:materiaId/grupos — F3-P4
   * Lists groups of a materia with student counts + userId + docenteName.
   */
  @Get('course-cycles/:ccId/materias/:materiaId/grupos')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listGrupos(@Param('materiaId') materiaId: string): Promise<{ data: GrupoResponse[] }> {
    const items = await this.listGruposUC.execute(materiaId);
    if (items.length === 0) return { data: [] };

    const client = TenantContext.getClient();

    // Resolve docenteXCicloId → userId from tenant DB
    const docenteXCicloIds = items.map((i) => i.grupo.docenteXCicloId);
    let userIdMap = new Map<string, string>(); // docenteXCicloId → userId
    if (client && docenteXCicloIds.length) {
      const docentes = await client.docenteXCiclo.findMany({
        where: { id: { in: docenteXCicloIds } },
        select: { id: true, userId: true },
      });
      userIdMap = new Map(
        docentes.map((d: { id: string; userId: string }) => [d.id, d.userId]),
      );
    }

    // Resolve userId → displayName from master DB
    const userIds = [...userIdMap.values()];
    let userNameMap = new Map<string, string>(); // userId → displayName
    if (userIds.length) {
      const masterClient = this.prismaService.getMasterClient();
      const users = await masterClient.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, name: true },
      });
      userNameMap = new Map(
        users.map(
          (u: { id: string; firstName: string | null; lastName: string | null; name: string }) => [
            u.id,
            [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name,
          ],
        ),
      );
    }

    return {
      data: items.map((item) => {
        const userId = userIdMap.get(item.grupo.docenteXCicloId) ?? '';
        const docenteName = userId ? (userNameMap.get(userId) ?? null) : null;
        return {
          id: item.grupo.id,
          materiaXCursoXCicloId: item.grupo.materiaXCursoXCicloId,
          docenteXCicloId: item.grupo.docenteXCicloId,
          name: item.grupo.name,
          alumnosCount: item.alumnos.length,
          userId,
          docenteName,
        };
      }),
    };
  }

  /**
   * GET /course-cycles/:ccId/materias/:materiaId/alumnos — F7
   * Lists all students enrolled in a materia (universe), enriched with studentName.
   */
  @Get('course-cycles/:ccId/materias/:materiaId/alumnos')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listAlumnosMateria(
    @Param('materiaId') materiaId: string,
  ): Promise<{ data: AlumnoMateriaItem[] }> {
    const client = TenantContext.getClient();
    if (!client) return { data: [] };

    const alumnos = await client.alumnosXMateriaXCursoXCiclo.findMany({
      where: { materiaXCursoXCicloId: materiaId },
      orderBy: { createdAt: 'asc' },
    });
    if (alumnos.length === 0) return { data: [] };

    const studentIds = alumnos.map((a: { studentId: string }) => a.studentId);
    const students = await client.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const studentNameMap = new Map(
      students.map(
        (s: { id: string; firstName: string; lastName: string }) => [
          s.id,
          `${s.firstName} ${s.lastName}`.trim(),
        ],
      ),
    );

    return {
      data: alumnos.map((a: { id: string; studentId: string }) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: studentNameMap.get(a.studentId) ?? a.studentId,
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
