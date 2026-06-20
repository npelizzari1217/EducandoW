import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
import { MateriasGruposModule } from '../materia-grupo-ciclo/materia-grupo-ciclo.module';
import { MaterializeMateriasUseCase } from '../../application/materia-grupo-ciclo/materialize-materias.use-case';
import { CourseCycleController } from './course-cycle.controller';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
  ListStudentsByCourseCycleUC,
} from '../../application/course-cycle/use-cases/course-cycle.use-cases';
import {
  GetActivePeriodUseCase,
  SetActivePeriodUseCase,
} from '../../application/course-cycle/use-cases/grading-period.use-cases';
import { AutoCreateCompetencyValuationsUC } from '../../application/pedagogy/use-cases/competency.use-cases';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { ListTeacherCourseCyclesUseCase } from '../../application/grading/list-teacher-course-cycles.use-case';
import { ListTeacherSubjectsInCourseCycleUseCase } from '../../application/grading/list-teacher-subjects-in-course-cycle.use-case';
import { ListAdminSubjectsInCourseCycleUseCase } from '../../application/grading/list-admin-subjects-in-course-cycle.use-case';
import { PrismaMateriaXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import type { CourseSectionRepository, AcademicCycleRepository, StudyPlanRepository } from '@educandow/domain';

// Tokens exported by PedagogyModule
const CourseSectionRepo = 'CourseSectionRepository';
const AcademicCycleRepo = 'AcademicCycleRepository';
const StudyPlanRepo = 'StudyPlanRepository';

@Module({
  imports: [AuthModule, PedagogyModule, forwardRef(() => MateriasGruposModule)],
  controllers: [CourseCycleController],
  providers: [
    PrismaCourseCycleRepository,
    {
      provide: CreateCourseCycleUseCase,
      useFactory: (
        cc: PrismaCourseCycleRepository,
        cs: CourseSectionRepository,
        ac: AcademicCycleRepository,
        sp: StudyPlanRepository,
      ) => new CreateCourseCycleUseCase(cc, cs, ac, sp),
      inject: [PrismaCourseCycleRepository, CourseSectionRepo, AcademicCycleRepo, StudyPlanRepo],
    },
    {
      provide: UpdateCourseCycleUseCase,
      useFactory: (r: PrismaCourseCycleRepository) => new UpdateCourseCycleUseCase(r),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: DeleteCourseCycleUseCase,
      useFactory: (r: PrismaCourseCycleRepository) => new DeleteCourseCycleUseCase(r),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: ToggleCourseCycleActiveUseCase,
      useFactory: (r: PrismaCourseCycleRepository) => new ToggleCourseCycleActiveUseCase(r),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: GetCourseCycleUseCase,
      useFactory: (r: PrismaCourseCycleRepository) => new GetCourseCycleUseCase(r),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: ListCourseCyclesUseCase,
      useFactory: (r: PrismaCourseCycleRepository) => new ListCourseCyclesUseCase(r),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: GenerateCourseCyclesUseCase,
      useFactory: (
        cc: PrismaCourseCycleRepository,
        sp: StudyPlanRepository,
        ac: AcademicCycleRepository,
        autoCreate: AutoCreateCompetencyValuationsUC,
        materialize: MaterializeMateriasUseCase,
      ) => new GenerateCourseCyclesUseCase(cc, sp, ac, autoCreate, materialize),
      inject: [PrismaCourseCycleRepository, StudyPlanRepo, AcademicCycleRepo, AutoCreateCompetencyValuationsUC, MaterializeMateriasUseCase],
    },
    {
      provide: GetActivePeriodUseCase,
      useFactory: (
        cc: PrismaCourseCycleRepository,
        ac: AcademicCycleRepository,
      ) => new GetActivePeriodUseCase(cc, ac),
      inject: [PrismaCourseCycleRepository, AcademicCycleRepo],
    },
    {
      provide: SetActivePeriodUseCase,
      useFactory: (cc: PrismaCourseCycleRepository) => new SetActivePeriodUseCase(cc),
      inject: [PrismaCourseCycleRepository],
    },
    {
      provide: ListStudentsByCourseCycleUC,
      useFactory: (r: PrismaCourseCycleRepository) => new ListStudentsByCourseCycleUC(r),
      inject: [PrismaCourseCycleRepository],
    },

    // Teacher-filter use cases — modelo NUEVO (DocenteXCiclo + grupos + AsignacionCursoXCiclo TITULAR)
    PrismaAsignacionCursoXCicloRepository,
    PrismaDocenteXCicloRepository,
    { provide: 'DocenteXCicloRepository', useExisting: PrismaDocenteXCicloRepository },
    PrismaGrupoRepository,
    { provide: 'GrupoRepository', useExisting: PrismaGrupoRepository },
    {
      provide: ListTeacherCourseCyclesUseCase,
      useFactory: (
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
        ccRepo: PrismaCourseCycleRepository,
      ) => new ListTeacherCourseCyclesUseCase(asignacionRepo, docenteRepo, grupoRepo, ccRepo),
      inject: [PrismaAsignacionCursoXCicloRepository, PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaCourseCycleRepository],
    },
    {
      provide: ListTeacherSubjectsInCourseCycleUseCase,
      useFactory: (
        docenteRepo: PrismaDocenteXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
      ) => new ListTeacherSubjectsInCourseCycleUseCase(docenteRepo, grupoRepo),
      inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository],
    },
    {
      provide: ListAdminSubjectsInCourseCycleUseCase,
      useFactory: (materiaRepo: PrismaMateriaXCursoXCicloRepository) =>
        new ListAdminSubjectsInCourseCycleUseCase(materiaRepo),
      inject: [PrismaMateriaXCursoXCicloRepository],
    },
  ],
  exports: [PrismaCourseCycleRepository],
})
export class CourseCycleModule {}
