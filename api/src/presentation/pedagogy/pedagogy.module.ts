import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyController } from './pedagogy.controller';
import * as UC from '../../application/pedagogy/use-cases/pedagogy.use-cases';
import { PrismaSubjectRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject.repository';
import { PrismaCourseSectionRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-course-section.repository';
import { PrismaSubjectAssignmentRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-assignment.repository';
import { PrismaEvaluacionRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-evaluacion.repository';
import { PrismaNotaRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-nota.repository';
import { PrismaPeriodoEvaluacionRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-periodo-evaluacion.repository';
import { PrismaNotaTrimestralRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-nota-trimestral.repository';
import { PrismaAttendanceRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance.repository';
import { PrismaAcademicCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository';
import { PrismaStudyPlanRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-study-plan.repository';

const repos = [PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaSubjectAssignmentRepo, PrismaEvaluacionRepo, PrismaNotaRepo, PrismaPeriodoEvaluacionRepo, PrismaNotaTrimestralRepo, PrismaAttendanceRepo, PrismaAcademicCycleRepository, PrismaStudyPlanRepository];
const tokens = ['SubjectRepository', 'CourseSectionRepository', 'SubjectAssignmentRepository', 'EvaluacionRepository', 'NotaRepository', 'PeriodoEvaluacionRepository', 'NotaTrimestralRepository', 'AttendanceRepository', 'AcademicCycleRepository', 'StudyPlanRepository'];

@Module({
  imports: [AuthModule],
  controllers: [PedagogyController],
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
    { provide: UC.CreateSubjectAssignmentUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.CreateSubjectAssignmentUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.ListSubjectAssignmentsUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.ListSubjectAssignmentsUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.DeleteSubjectAssignmentUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.DeleteSubjectAssignmentUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.CreateEvaluacionUC, useFactory: (r: PrismaEvaluacionRepo) => new UC.CreateEvaluacionUC(r), inject: ['EvaluacionRepository'] },
    { provide: UC.ListEvaluacionesUC, useFactory: (r: PrismaEvaluacionRepo) => new UC.ListEvaluacionesUC(r), inject: ['EvaluacionRepository'] },
    { provide: UC.DeleteEvaluacionUC, useFactory: (r: PrismaEvaluacionRepo) => new UC.DeleteEvaluacionUC(r), inject: ['EvaluacionRepository'] },
    { provide: UC.CreateNotaUC, useFactory: (r: PrismaNotaRepo) => new UC.CreateNotaUC(r), inject: ['NotaRepository'] },
    { provide: UC.ListNotasUC, useFactory: (r: PrismaNotaRepo) => new UC.ListNotasUC(r), inject: ['NotaRepository'] },
    { provide: UC.DeleteNotaUC, useFactory: (r: PrismaNotaRepo) => new UC.DeleteNotaUC(r), inject: ['NotaRepository'] },
    { provide: UC.CreatePeriodoUC, useFactory: (r: PrismaPeriodoEvaluacionRepo) => new UC.CreatePeriodoUC(r), inject: ['PeriodoEvaluacionRepository'] },
    { provide: UC.ListPeriodosUC, useFactory: (r: PrismaPeriodoEvaluacionRepo) => new UC.ListPeriodosUC(r), inject: ['PeriodoEvaluacionRepository'] },
    { provide: UC.DeletePeriodoUC, useFactory: (r: PrismaPeriodoEvaluacionRepo) => new UC.DeletePeriodoUC(r), inject: ['PeriodoEvaluacionRepository'] },
    { provide: UC.CreateNotaTrimestralUC, useFactory: (r: PrismaNotaTrimestralRepo) => new UC.CreateNotaTrimestralUC(r), inject: ['NotaTrimestralRepository'] },
    { provide: UC.ListNotasTrimestralesUC, useFactory: (r: PrismaNotaTrimestralRepo) => new UC.ListNotasTrimestralesUC(r), inject: ['NotaTrimestralRepository'] },
    { provide: UC.DeleteNotaTrimestralUC, useFactory: (r: PrismaNotaTrimestralRepo) => new UC.DeleteNotaTrimestralUC(r), inject: ['NotaTrimestralRepository'] },
    { provide: UC.CreateAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.CreateAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.ListAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.ListAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.DeleteAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.DeleteAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.ListAcademicCyclesUC, useFactory: (r: PrismaAcademicCycleRepository) => new UC.ListAcademicCyclesUC(r), inject: ['AcademicCycleRepository'] },
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
  ],
})
export class PedagogyModule {}
