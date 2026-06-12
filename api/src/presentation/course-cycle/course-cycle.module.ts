import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
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
import { PrismaTeacherRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-teacher.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { ListTeacherCourseCyclesUseCase } from '../../application/grading/list-teacher-course-cycles.use-case';
import { ListTeacherSubjectsInCourseCycleUseCase } from '../../application/grading/list-teacher-subjects-in-course-cycle.use-case';
import type { CourseSectionRepository, AcademicCycleRepository, StudyPlanRepository, EnrollmentRepository } from '@educandow/domain';

// Tokens exported by PedagogyModule
const CourseSectionRepo = 'CourseSectionRepository';
const AcademicCycleRepo = 'AcademicCycleRepository';
const StudyPlanRepo = 'StudyPlanRepository';
const EnrollmentRepo = 'EnrollmentRepository';

@Module({
  imports: [AuthModule, PedagogyModule, EnrollmentModule, forwardRef(() => MateriasGruposModule)],
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
      useFactory: (cc: PrismaCourseCycleRepository, er: EnrollmentRepository) => new SetActivePeriodUseCase(cc, er),
      inject: [PrismaCourseCycleRepository, EnrollmentRepo],
    },
    {
      provide: ListStudentsByCourseCycleUC,
      useFactory: (r: PrismaCourseCycleRepository) => new ListStudentsByCourseCycleUC(r),
      inject: [PrismaCourseCycleRepository],
    },

    // Teacher-filter use cases — modelo NUEVO (DocenteXCiclo + grupos)
    // teacherRepo kept for homeroom mode only
    PrismaTeacherRepository,
    { provide: 'TeacherRepository', useExisting: PrismaTeacherRepository },
    PrismaDocenteXCicloRepository,
    { provide: 'DocenteXCicloRepository', useExisting: PrismaDocenteXCicloRepository },
    PrismaGrupoRepository,
    { provide: 'GrupoRepository', useExisting: PrismaGrupoRepository },
    {
      provide: ListTeacherCourseCyclesUseCase,
      useFactory: (
        teacherRepo: PrismaTeacherRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
        ccRepo: PrismaCourseCycleRepository,
      ) => new ListTeacherCourseCyclesUseCase(teacherRepo, docenteRepo, grupoRepo, ccRepo),
      inject: [PrismaTeacherRepository, PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaCourseCycleRepository],
    },
    {
      provide: ListTeacherSubjectsInCourseCycleUseCase,
      useFactory: (
        docenteRepo: PrismaDocenteXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
      ) => new ListTeacherSubjectsInCourseCycleUseCase(docenteRepo, grupoRepo),
      inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository],
    },
  ],
  exports: [PrismaCourseCycleRepository],
})
export class CourseCycleModule {}
