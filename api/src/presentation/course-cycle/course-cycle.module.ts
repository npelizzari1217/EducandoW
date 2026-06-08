import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { CourseCycleController } from './course-cycle.controller';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
} from '../../application/course-cycle/use-cases/course-cycle.use-cases';
import {
  GetActivePeriodUseCase,
  SetActivePeriodUseCase,
} from '../../application/course-cycle/use-cases/grading-period.use-cases';
import { AutoCreateCompetencyValuationsUC } from '../../application/pedagogy/use-cases/competency.use-cases';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';
import type { CourseSectionRepository, AcademicCycleRepository, StudyPlanRepository, EnrollmentRepository } from '@educandow/domain';

// Tokens exported by PedagogyModule
const CourseSectionRepo = 'CourseSectionRepository';
const AcademicCycleRepo = 'AcademicCycleRepository';
const StudyPlanRepo = 'StudyPlanRepository';
const EnrollmentRepo = 'EnrollmentRepository';

@Module({
  imports: [AuthModule, PedagogyModule, EnrollmentModule],
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
      ) => new GenerateCourseCyclesUseCase(cc, sp, ac, autoCreate),
      inject: [PrismaCourseCycleRepository, StudyPlanRepo, AcademicCycleRepo, AutoCreateCompetencyValuationsUC],
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
  ],
  exports: [PrismaCourseCycleRepository],
})
export class CourseCycleModule {}
