import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyController } from './pedagogy.controller';
import * as UC from '../../application/pedagogy/use-cases/pedagogy.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaSubjectRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject.repository';
import { PrismaCourseSectionRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-course-section.repository';
import { PrismaSubjectAssignmentRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-assignment.repository';
import { PrismaGradeRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-grade.repository';
import { PrismaAttendanceRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance.repository';

const repos = [PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaSubjectAssignmentRepo, PrismaGradeRepo, PrismaAttendanceRepo];
const tokens = ['SubjectRepository', 'CourseSectionRepository', 'SubjectAssignmentRepository', 'GradeRepository', 'AttendanceRepository'];

@Module({
  imports: [AuthModule],
  controllers: [PedagogyController],
  providers: [
    PrismaService,
    ...repos.map((Repo, i) => ({ provide: Repo, useFactory: (p: PrismaService) => new Repo(p), inject: [PrismaService] })),
    ...tokens.map((t, i) => ({ provide: t, useExisting: repos[i] })),
    { provide: UC.CreateSubjectUC, useFactory: (r: PrismaSubjectRepo) => new UC.CreateSubjectUC(r), inject: ['SubjectRepository'] },
    { provide: UC.ListSubjectsUC, useFactory: (r: PrismaSubjectRepo) => new UC.ListSubjectsUC(r), inject: ['SubjectRepository'] },
    { provide: UC.DeleteSubjectUC, useFactory: (r: PrismaSubjectRepo) => new UC.DeleteSubjectUC(r), inject: ['SubjectRepository'] },
    { provide: UC.CreateCourseSectionUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.CreateCourseSectionUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.ListCourseSectionsUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.ListCourseSectionsUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.DeleteCourseSectionUC, useFactory: (r: PrismaCourseSectionRepo) => new UC.DeleteCourseSectionUC(r), inject: ['CourseSectionRepository'] },
    { provide: UC.CreateSubjectAssignmentUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.CreateSubjectAssignmentUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.ListSubjectAssignmentsUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.ListSubjectAssignmentsUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.DeleteSubjectAssignmentUC, useFactory: (r: PrismaSubjectAssignmentRepo) => new UC.DeleteSubjectAssignmentUC(r), inject: ['SubjectAssignmentRepository'] },
    { provide: UC.CreateGradeUC, useFactory: (r: PrismaGradeRepo) => new UC.CreateGradeUC(r), inject: ['GradeRepository'] },
    { provide: UC.ListGradesUC, useFactory: (r: PrismaGradeRepo) => new UC.ListGradesUC(r), inject: ['GradeRepository'] },
    { provide: UC.DeleteGradeUC, useFactory: (r: PrismaGradeRepo) => new UC.DeleteGradeUC(r), inject: ['GradeRepository'] },
    { provide: UC.CreateAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.CreateAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.ListAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.ListAttendanceUC(r), inject: ['AttendanceRepository'] },
    { provide: UC.DeleteAttendanceUC, useFactory: (r: PrismaAttendanceRepo) => new UC.DeleteAttendanceUC(r), inject: ['AttendanceRepository'] },
  ],
})
export class PedagogyModule {}
