import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentController } from './student.controller';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
} from '../../application/student/use-cases/student.use-cases';
import { PrismaStudentRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-student.repository';

@Module({
  imports: [AuthModule],
  controllers: [StudentController],
  providers: [
    PrismaStudentRepository,
    { provide: 'StudentRepository', useExisting: PrismaStudentRepository },
    { provide: CreateStudentUseCase, useFactory: (r) => new CreateStudentUseCase(r), inject: ['StudentRepository'] },
    { provide: ListStudentsUseCase, useFactory: (r) => new ListStudentsUseCase(r), inject: ['StudentRepository'] },
    { provide: GetStudentUseCase, useFactory: (r) => new GetStudentUseCase(r), inject: ['StudentRepository'] },
    { provide: DeleteStudentUseCase, useFactory: (r) => new DeleteStudentUseCase(r), inject: ['StudentRepository'] },
  ],
  exports: ['StudentRepository', PrismaStudentRepository],
})
export class StudentModule {}
