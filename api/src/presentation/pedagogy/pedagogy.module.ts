import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportesModule } from '../reportes/reportes.module';
import { PedagogyController } from './pedagogy.controller';
import * as UC from '../../application/pedagogy/use-cases/pedagogy.use-cases';
import * as CUC from '../../application/pedagogy/use-cases/competency.use-cases';
import { PrismaSubjectRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject.repository';
import { PrismaCourseSectionRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-course-section.repository';
import { PrismaAttendanceRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance.repository';
import { PrismaAcademicCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository';
import { PrismaStudyPlanRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-study-plan.repository';
import { PrismaSubjectCompetencyRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-competency.repository';
import { PrismaCompetencyValuationRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository';
import { PrismaCompetencyPeriodValuationRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-competency-period-valuation.repository';
import { PrismaGradeScaleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository';
import { PrismaGradingPeriodRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grading-period.repository';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';

const repos = [PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaAttendanceRepo, PrismaAcademicCycleRepository, PrismaStudyPlanRepository, PrismaSubjectCompetencyRepo, PrismaCompetencyValuationRepo];
const tokens = ['SubjectRepository', 'CourseSectionRepository', 'AttendanceRepository', 'AcademicCycleRepository', 'StudyPlanRepository', 'SubjectCompetencyRepository', 'CompetencyValuationRepository'];

@Module({
  imports: [AuthModule, ReportesModule],
  controllers: [PedagogyController],
  exports: ['CourseSectionRepository', 'AcademicCycleRepository', 'StudyPlanRepository', CUC.AutoCreateCompetencyValuationsUC],
  providers: [
    ...repos,
    ...tokens.map((t, i) => ({ provide: t, useExisting: repos[i] })),
    { provide: UC.CreateSubjectUC, useFactory: (r: PrismaSubjectRepo) => new UC.CreateSubjectUC(r), inject: ['SubjectRepository'] },
    { provide: UC.ListSubjectsUC, useFactory: (r: PrismaSubjectRepo) => new UC.ListSubjectsUC(r), inject: ['SubjectRepository'] },
    { provide: UC.DeleteSubjectUC, useFactory: (r: PrismaSubjectRepo) => new UC.DeleteSubjectUC(r), inject: ['SubjectRepository'] },
    { provide: UC.UpdateSubjectUC, useFactory: (r: PrismaSubjectRepo) => new UC.UpdateSubjectUC(r), inject: ['SubjectRepository'] },
    { provide: UC.CreateCourseSectionUC, useFactory: (cs: PrismaCourseSectionRepo, sp: PrismaStudyPlanRepository) => new UC.CreateCourseSectionUC(cs, sp), inject: ['CourseSectionRepository', 'StudyPlanRepository'] },
    { provide: UC.ListCourseSectionsUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.ListCourseSectionsUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.DeleteCourseSectionUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.DeleteCourseSectionUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.UpdateCourseSectionUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.UpdateCourseSectionUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.CreateAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.CreateAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.ListAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.ListAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.DeleteAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.DeleteAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.ListAcademicCyclesUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.ListAcademicCyclesUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.GetAcademicCycleUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.GetAcademicCycleUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.CreateAcademicCycleUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.CreateAcademicCycleUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.UpdateAcademicCycleUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.UpdateAcademicCycleUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.DeleteAcademicCycleUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.DeleteAcademicCycleUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.ToggleAcademicCycleActiveUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.ToggleAcademicCycleActiveUC(r), inject: ['AcademicCycleRepository'] },
    { provide: UC.CreateStudyPlanUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.CreateStudyPlanUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.UpdateStudyPlanUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.UpdateStudyPlanUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.ListStudyPlansUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.ListStudyPlansUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.GetStudyPlanUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.GetStudyPlanUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.DeleteStudyPlanUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.DeleteStudyPlanUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.AddCourseToPlanUC, useFactory: (sp: PrismaStudyPlanRepository, cs: PrismaCourseSectionRepo) => new UC.AddCourseToPlanUC(sp, cs), inject: ['StudyPlanRepository', 'CourseSectionRepository'] },
    { provide: UC.RemoveCourseFromPlanUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.RemoveCourseFromPlanUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.AddSubjectToPlanCourseUC, useFactory: (sp: PrismaStudyPlanRepository, subj: PrismaSubjectRepo) => new UC.AddSubjectToPlanCourseUC(sp, subj), inject: ['StudyPlanRepository', 'SubjectRepository'] },
    { provide: UC.RemoveSubjectFromPlanCourseUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.RemoveSubjectFromPlanCourseUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.GetPlanCourseDetailUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.GetPlanCourseDetailUC(r), inject: ['StudyPlanRepository'] },
    { provide: UC.ListPlanCoursesUC, useFactory: (r: PrismaStudyPlanRepository) => new UC.ListPlanCoursesUC(r), inject: ['StudyPlanRepository'] },
    // Competency use cases
    { provide: CUC.CreateSubjectCompetencyUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.CreateSubjectCompetencyUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.ListSubjectCompetenciesUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.ListSubjectCompetenciesUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.GetSubjectCompetencyUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.GetSubjectCompetencyUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.UpdateSubjectCompetencyUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.UpdateSubjectCompetencyUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.DeleteSubjectCompetencyUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.DeleteSubjectCompetencyUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.ListCompetencyValuationsUC, useFactory: (r: PrismaCompetencyValuationRepo) => new CUC.ListCompetencyValuationsUC(r), inject: ['CompetencyValuationRepository'] },
    { provide: CUC.GetCompetencyValuationUC, useFactory: (r: PrismaCompetencyValuationRepo) => new CUC.GetCompetencyValuationUC(r), inject: ['CompetencyValuationRepository'] },
    { provide: CUC.ListBulkCompetencyValuationsUC, useFactory: (r: PrismaCompetencyValuationRepo) => new CUC.ListBulkCompetencyValuationsUC(r), inject: ['CompetencyValuationRepository'] },
    { provide: CUC.CopySubjectCompetenciesUC, useFactory: (r: PrismaSubjectCompetencyRepo) => new CUC.CopySubjectCompetenciesUC(r), inject: ['SubjectCompetencyRepository'] },
    { provide: CUC.AutoCreateCompetencyValuationsUC, useFactory: (comp: PrismaSubjectCompetencyRepo, val: PrismaCompetencyValuationRepo, sp: PrismaStudyPlanRepository) => new CUC.AutoCreateCompetencyValuationsUC(comp, val, sp), inject: ['SubjectCompetencyRepository', 'CompetencyValuationRepository', 'StudyPlanRepository'] },
    // PR3 — period grading repos + UC
    PrismaCompetencyPeriodValuationRepository,
    { provide: 'CompetencyPeriodValuationRepository', useExisting: PrismaCompetencyPeriodValuationRepository },
    PrismaGradeScaleRepository,
    { provide: 'GradeScaleRepository', useExisting: PrismaGradeScaleRepository },
    PrismaGradingPeriodRepository,
    { provide: 'GradingPeriodRepository', useExisting: PrismaGradingPeriodRepository },
    PrismaCourseCycleRepository,
    { provide: 'CourseCycleRepository', useExisting: PrismaCourseCycleRepository },
    {
      provide: CUC.GradePeriodValuationUC,
      useFactory: (
        val: PrismaCompetencyValuationRepo,
        cc: PrismaCourseCycleRepository,
        period: PrismaGradingPeriodRepository,
        scale: PrismaGradeScaleRepository,
        periodVal: PrismaCompetencyPeriodValuationRepository,
      ) => new CUC.GradePeriodValuationUC(val, cc, period, scale, periodVal),
      inject: ['CompetencyValuationRepository', 'CourseCycleRepository', 'GradingPeriodRepository', 'GradeScaleRepository', 'CompetencyPeriodValuationRepository'],
    },
  ],
})
export class PedagogyModule {}
