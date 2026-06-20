import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourseCycleModule } from '../course-cycle/course-cycle.module';
import { StudentObservationWriteController, StudentObservationReadController } from './student-observation.controller';
import { CreateObservationUseCase } from '../../application/student-observation/create-observation.use-case';
import { ListObservationsByStudentUseCase } from '../../application/student-observation/list-by-student.use-case';
import { ListObservationsByCourseUseCase } from '../../application/student-observation/list-by-course.use-case';
import { ListObservationsByCycleUseCase } from '../../application/student-observation/list-by-cycle.use-case';
import { DeleteObservationUseCase } from '../../application/student-observation/delete-observation.use-case';
import { PrismaStudentObservationRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-student-observation.repository';
import { PrismaCourseCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository';

@Module({
  imports: [AuthModule, CourseCycleModule],
  controllers: [StudentObservationWriteController, StudentObservationReadController],
  providers: [
    PrismaStudentObservationRepository,
    { provide: 'StudentObservationRepository', useExisting: PrismaStudentObservationRepository },
    { provide: CreateObservationUseCase, useFactory: (r) => new CreateObservationUseCase(r), inject: ['StudentObservationRepository'] },
    { provide: ListObservationsByStudentUseCase, useFactory: (r) => new ListObservationsByStudentUseCase(r), inject: ['StudentObservationRepository'] },
    {
      provide: ListObservationsByCourseUseCase,
      useFactory: (obsRepo, cycleRepo) => new ListObservationsByCourseUseCase(obsRepo, cycleRepo),
      inject: ['StudentObservationRepository', PrismaCourseCycleRepository],
    },
    {
      provide: ListObservationsByCycleUseCase,
      useFactory: (obsRepo) => new ListObservationsByCycleUseCase(obsRepo),
      inject: ['StudentObservationRepository'],
    },
    { provide: DeleteObservationUseCase, useFactory: (r) => new DeleteObservationUseCase(r), inject: ['StudentObservationRepository'] },
  ],
  exports: ['StudentObservationRepository', PrismaStudentObservationRepository],
})
export class StudentObservationModule {}
