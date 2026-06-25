import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentModule } from '../student/student.module';
import { AlumnosXCursoXCicloController } from './alumnos-x-curso-x-ciclo.controller';
import { PrismaAlumnosXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';
import { PrismaSubjectCompetencyRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-competency.repository';
import { PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository';
import { AddStudentToCourseCycleUseCase } from '../../application/course-cycle/add-student-to-course-cycle.use-case';
import { ListStudentsByCourseCycleUseCase } from '../../application/course-cycle/list-students-by-course-cycle.use-case';
import { RemoveStudentFromCourseCycleUseCase } from '../../application/course-cycle/remove-student-from-course-cycle.use-case';
import { TogglePrintableUseCase } from '../../application/course-cycle/toggle-printable.use-case';
import { SetCoursePrintableUseCase } from '../../application/course-cycle/set-course-printable.use-case';
import { ListStudentMembershipsUseCase } from '../../application/course-cycle/list-student-memberships.use-case';
import { CascadeStudentMateriasCompetenciasUseCase } from '../../application/course-cycle/cascade-student-materias-competencias.use-case';
import { CascadeAllStudentsMateriasCompetenciasUseCase } from '../../application/course-cycle/cascade-all-students-materias-competencias.use-case';

/**
 * AlumnosXCursoXCicloModule — SDD-1 PR-3 (T-18).
 *
 * Wires the Prisma repos + 3 use-cases + controller for the
 * AlumnosXCursoXCiclo slice.  Dedicated module (ADR-6): does NOT inflate
 * CourseCycleModule or MateriasGruposModule.
 *
 * Provides PrismaCourseCycleRepository locally (not re-exported from
 * CourseCycleModule) to avoid circular import chains.
 *
 * 'StudentRepository' token is imported from StudentModule (StudentModule
 * exports both the class and the string-token alias).
 */
@Module({
  imports: [AuthModule, StudentModule],
  controllers: [AlumnosXCursoXCicloController],
  providers: [
    // ── Repositories ──────────────────────────────────────────────────────────
    PrismaAlumnosXCursoXCicloRepository,
    PrismaCourseCycleRepository,
    PrismaMateriaXCursoXCicloRepository,
    PrismaAlumnosXMateriaRepository,
    PrismaSubjectCompetencyRepo,
    PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,

    // ── Use-cases ─────────────────────────────────────────────────────────────

    {
      provide: AddStudentToCourseCycleUseCase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (ccRepo: PrismaCourseCycleRepository, alumnosRepo: PrismaAlumnosXCursoXCicloRepository, studentRepo: any) =>
        new AddStudentToCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo),
      inject: [PrismaCourseCycleRepository, PrismaAlumnosXCursoXCicloRepository, 'StudentRepository'],
    },

    {
      provide: ListStudentsByCourseCycleUseCase,
      useFactory: (alumnosRepo: PrismaAlumnosXCursoXCicloRepository) =>
        new ListStudentsByCourseCycleUseCase(alumnosRepo),
      inject: [PrismaAlumnosXCursoXCicloRepository],
    },

    {
      provide: RemoveStudentFromCourseCycleUseCase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (ccRepo: PrismaCourseCycleRepository, alumnosRepo: PrismaAlumnosXCursoXCicloRepository, studentRepo: any) =>
        new RemoveStudentFromCourseCycleUseCase(ccRepo, alumnosRepo, studentRepo),
      inject: [PrismaCourseCycleRepository, PrismaAlumnosXCursoXCicloRepository, 'StudentRepository'],
    },

    {
      provide: TogglePrintableUseCase,
      useFactory: (alumnosRepo: PrismaAlumnosXCursoXCicloRepository) =>
        new TogglePrintableUseCase(alumnosRepo),
      inject: [PrismaAlumnosXCursoXCicloRepository],
    },

    {
      provide: SetCoursePrintableUseCase,
      useFactory: (alumnosRepo: PrismaAlumnosXCursoXCicloRepository) =>
        new SetCoursePrintableUseCase(alumnosRepo),
      inject: [PrismaAlumnosXCursoXCicloRepository],
    },

    {
      provide: ListStudentMembershipsUseCase,
      useFactory: (alumnosRepo: PrismaAlumnosXCursoXCicloRepository) =>
        new ListStudentMembershipsUseCase(alumnosRepo),
      inject: [PrismaAlumnosXCursoXCicloRepository],
    },

    {
      provide: CascadeAllStudentsMateriasCompetenciasUseCase,
      useFactory: (
        alumnosCCRepo: PrismaAlumnosXCursoXCicloRepository,
        materiaRepo: PrismaMateriaXCursoXCicloRepository,
        alumnosXMateriaRepo: PrismaAlumnosXMateriaRepository,
        competencyRepo: PrismaSubjectCompetencyRepo,
        competenciaRepo: PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
      ) =>
        new CascadeAllStudentsMateriasCompetenciasUseCase(
          alumnosCCRepo,
          materiaRepo,
          alumnosXMateriaRepo,
          competencyRepo,
          competenciaRepo,
        ),
      inject: [
        PrismaAlumnosXCursoXCicloRepository,
        PrismaMateriaXCursoXCicloRepository,
        PrismaAlumnosXMateriaRepository,
        PrismaSubjectCompetencyRepo,
        PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
      ],
    },

    {
      provide: CascadeStudentMateriasCompetenciasUseCase,
      useFactory: (
        alumnosCCRepo: PrismaAlumnosXCursoXCicloRepository,
        materiaRepo: PrismaMateriaXCursoXCicloRepository,
        alumnosXMateriaRepo: PrismaAlumnosXMateriaRepository,
        competencyRepo: PrismaSubjectCompetencyRepo,
        competenciaRepo: PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
      ) =>
        new CascadeStudentMateriasCompetenciasUseCase(
          alumnosCCRepo,
          materiaRepo,
          alumnosXMateriaRepo,
          competencyRepo,
          competenciaRepo,
        ),
      inject: [
        PrismaAlumnosXCursoXCicloRepository,
        PrismaMateriaXCursoXCicloRepository,
        PrismaAlumnosXMateriaRepository,
        PrismaSubjectCompetencyRepo,
        PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
      ],
    },
  ],
})
export class AlumnosXCursoXCicloModule {}
