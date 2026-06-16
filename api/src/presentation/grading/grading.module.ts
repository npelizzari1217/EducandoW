import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GradingScalesController } from './grading-scales.controller';
import { GradingPeriodsController } from './grading-periods.controller';
import { SubjectGradesController } from './subject-grades.controller';
import {
  CreateGradeScaleUseCase,
  UpdateGradeScaleUseCase,
  DeleteGradeScaleUseCase,
  ListGradeScalesUseCase,
  GetGradeScaleUseCase,
} from '../../application/grading/use-cases/grade-scale.use-cases';
import {
  CreateGradeScaleValueUseCase,
  UpdateGradeScaleValueUseCase,
  DeleteGradeScaleValueUseCase,
} from '../../application/grading/use-cases/grade-scale-value.use-cases';
import {
  CreateGradingPeriodTemplateUseCase,
  UpdateGradingPeriodTemplateUseCase,
  DeleteGradingPeriodTemplateUseCase,
  ListGradingPeriodTemplatesUseCase,
  GetGradingPeriodTemplateUseCase,
} from '../../application/grading/use-cases/grading-period-template.use-cases';
import {
  UpsertPeriodDatesUseCase,
  ListPeriodDatesUseCase,
} from '../../application/grading/use-cases/grading-period-date.use-cases';
import { PrismaGradeScaleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository';
import { PrismaGradingPeriodRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grading-period.repository';
import { PrismaAcademicCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaSubjectGradingPeriodRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-grading-period.repository';
import { PrismaSubjectPeriodGradeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-period-grade.repository';
import { PrismaSubjectFinalGradeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository';
import { PrismaCompetencyValuationRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
import { AssignmentAuthorizer } from '../../application/grading/assignment-authorizer.service';
import { GetSubjectGradesBySubjectUseCase } from '../../application/grading/get-subject-grades-by-subject.use-case';
import { GetSubjectGradesByStudentUseCase } from '../../application/grading/get-subject-grades-by-student.use-case';
import { UpsertSubjectPeriodGradesUseCase } from '../../application/grading/upsert-subject-period-grades.use-case';
import { UpsertSubjectFinalGradesUseCase } from '../../application/grading/upsert-subject-final-grades.use-case';

/**
 * GradingModule — escalas (1a) + períodos (1b) + planillas (4a read).
 */
@Module({
  imports: [AuthModule],
  controllers: [
    GradingScalesController,
    GradingPeriodsController,
    SubjectGradesController,
  ],
  providers: [
    PrismaService,

    // ── Grade Scale repo + use cases ──────────────────────
    {
      provide: PrismaGradeScaleRepository,
      useClass: PrismaGradeScaleRepository,
    },
    { provide: 'GradeScaleRepository', useExisting: PrismaGradeScaleRepository },
    {
      provide: CreateGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new CreateGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: UpdateGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new UpdateGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: DeleteGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new DeleteGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: ListGradeScalesUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new ListGradeScalesUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: GetGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new GetGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: CreateGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new CreateGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: UpdateGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new UpdateGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: DeleteGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new DeleteGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },

    // ── Grading Period repo + AcademicCycle repo + use cases ─
    {
      provide: PrismaGradingPeriodRepository,
      useClass: PrismaGradingPeriodRepository,
    },
    { provide: 'GradingPeriodRepository', useExisting: PrismaGradingPeriodRepository },
    {
      provide: PrismaAcademicCycleRepository,
      useClass: PrismaAcademicCycleRepository,
    },
    { provide: 'AcademicCycleRepository', useExisting: PrismaAcademicCycleRepository },
    {
      provide: CreateGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new CreateGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: UpdateGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new UpdateGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: DeleteGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new DeleteGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: ListGradingPeriodTemplatesUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new ListGradingPeriodTemplatesUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: GetGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new GetGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: UpsertPeriodDatesUseCase,
      useFactory: (
        periodRepo: PrismaGradingPeriodRepository,
        cycleRepo: PrismaAcademicCycleRepository,
      ) => new UpsertPeriodDatesUseCase(periodRepo, cycleRepo),
      inject: ['GradingPeriodRepository', 'AcademicCycleRepository'],
    },
    {
      provide: ListPeriodDatesUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) => new ListPeriodDatesUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },

    // ── PR4a: Subject grades read use cases + repos ─────────────────────────
    PrismaSubjectGradingPeriodRepository,
    { provide: 'SubjectGradingPeriodRepository', useExisting: PrismaSubjectGradingPeriodRepository },
    PrismaSubjectPeriodGradeRepository,
    { provide: 'SubjectPeriodGradeRepository', useExisting: PrismaSubjectPeriodGradeRepository },
    PrismaSubjectFinalGradeRepository,
    { provide: 'SubjectFinalGradeRepository', useExisting: PrismaSubjectFinalGradeRepository },
    PrismaCompetencyValuationRepo,
    { provide: 'CompetencyValuationRepository', useExisting: PrismaCompetencyValuationRepo },
    PrismaCourseCycleRepository,

    // ── Fase 5: group-assignment authorizer (used by both read and write paths) ─
    PrismaDocenteXCicloRepository,
    { provide: 'DocenteXCicloRepository', useExisting: PrismaDocenteXCicloRepository },
    PrismaGrupoRepository,
    { provide: 'GrupoRepository', useExisting: PrismaGrupoRepository },
    // AlumnosXGrupo repo — needed by AssignmentAuthorizer for getAllowedStudentIds (T9)
    // Note: also provided in materia-grupo-ciclo.module but that module is NOT imported here
    PrismaAlumnosXGrupoRepository,
    { provide: 'AlumnosXGrupoRepository', useExisting: PrismaAlumnosXGrupoRepository },
    {
      provide: AssignmentAuthorizer,
      useFactory: (
        docenteRepo: PrismaDocenteXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
        alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
      ) => new AssignmentAuthorizer(docenteRepo, grupoRepo, alumnosXGrupoRepo),
      inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaAlumnosXGrupoRepository],
    },
    {
      provide: GetSubjectGradesBySubjectUseCase,
      useFactory: (
        sgpRepo: PrismaSubjectGradingPeriodRepository,
        pgRepo: PrismaSubjectPeriodGradeRepository,
        fgRepo: PrismaSubjectFinalGradeRepository,
        cvRepo: PrismaCompetencyValuationRepo,
        ccRepo: PrismaCourseCycleRepository,
        authorizer: AssignmentAuthorizer,
      ) => new GetSubjectGradesBySubjectUseCase(sgpRepo, pgRepo, fgRepo, cvRepo, ccRepo, authorizer),
      inject: [
        PrismaSubjectGradingPeriodRepository,
        PrismaSubjectPeriodGradeRepository,
        PrismaSubjectFinalGradeRepository,
        PrismaCompetencyValuationRepo,
        PrismaCourseCycleRepository,
        AssignmentAuthorizer,
      ],
    },
    {
      provide: GetSubjectGradesByStudentUseCase,
      useFactory: (
        sgpRepo: PrismaSubjectGradingPeriodRepository,
        pgRepo: PrismaSubjectPeriodGradeRepository,
        fgRepo: PrismaSubjectFinalGradeRepository,
        cvRepo: PrismaCompetencyValuationRepo,
        authorizer: AssignmentAuthorizer,
      ) => new GetSubjectGradesByStudentUseCase(sgpRepo, pgRepo, fgRepo, cvRepo, authorizer),
      inject: [
        PrismaSubjectGradingPeriodRepository,
        PrismaSubjectPeriodGradeRepository,
        PrismaSubjectFinalGradeRepository,
        PrismaCompetencyValuationRepo,
        AssignmentAuthorizer,
      ],
    },

    // ── PR4b: Subject grades write use cases ────────────────────────────────
    {
      provide: UpsertSubjectPeriodGradesUseCase,
      useFactory: (
        pgRepo: PrismaSubjectPeriodGradeRepository,
        sgpRepo: PrismaSubjectGradingPeriodRepository,
        ccRepo: PrismaCourseCycleRepository,
        scaleRepo: PrismaGradeScaleRepository,
        authorizer: AssignmentAuthorizer,
      ) => new UpsertSubjectPeriodGradesUseCase(pgRepo, sgpRepo, ccRepo, scaleRepo, authorizer),
      inject: [
        PrismaSubjectPeriodGradeRepository,
        PrismaSubjectGradingPeriodRepository,
        PrismaCourseCycleRepository,
        PrismaGradeScaleRepository,
        AssignmentAuthorizer,
      ],
    },
    {
      provide: UpsertSubjectFinalGradesUseCase,
      useFactory: (
        fgRepo: PrismaSubjectFinalGradeRepository,
        ccRepo: PrismaCourseCycleRepository,
        scaleRepo: PrismaGradeScaleRepository,
        authorizer: AssignmentAuthorizer,
      ) => new UpsertSubjectFinalGradesUseCase(fgRepo, ccRepo, scaleRepo, authorizer),
      inject: [
        PrismaSubjectFinalGradeRepository,
        PrismaCourseCycleRepository,
        PrismaGradeScaleRepository,
        AssignmentAuthorizer,
      ],
    },
  ],
})
export class GradingModule {}
