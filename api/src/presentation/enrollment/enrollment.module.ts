import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentController } from './enrollment.controller';
import {
  CreateEnrollmentUseCase, ListEnrollmentsUseCase, GetEnrollmentUseCase, DeleteEnrollmentUseCase,
  ToggleEnrollmentFlagUseCase, BulkToggleEnrollmentFlagsUseCase,
} from '../../application/enrollment/use-cases/enrollment.use-cases';
import { PrismaEnrollmentRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-enrollment.repository';

@Module({
  imports: [AuthModule],
  controllers: [EnrollmentController],
  providers: [
    PrismaEnrollmentRepository,
    { provide: 'EnrollmentRepository', useExisting: PrismaEnrollmentRepository },
    { provide: CreateEnrollmentUseCase, useFactory: (r) => new CreateEnrollmentUseCase(r), inject: ['EnrollmentRepository'] },
    { provide: ListEnrollmentsUseCase, useFactory: (r) => new ListEnrollmentsUseCase(r), inject: ['EnrollmentRepository'] },
    { provide: GetEnrollmentUseCase, useFactory: (r) => new GetEnrollmentUseCase(r), inject: ['EnrollmentRepository'] },
    { provide: DeleteEnrollmentUseCase, useFactory: (r) => new DeleteEnrollmentUseCase(r), inject: ['EnrollmentRepository'] },
    { provide: ToggleEnrollmentFlagUseCase, useFactory: (r) => new ToggleEnrollmentFlagUseCase(r), inject: ['EnrollmentRepository'] },
    { provide: BulkToggleEnrollmentFlagsUseCase, useFactory: (r) => new BulkToggleEnrollmentFlagsUseCase(r), inject: ['EnrollmentRepository'] },
  ],
  exports: ['EnrollmentRepository', PrismaEnrollmentRepository],
})
export class EnrollmentModule {}
