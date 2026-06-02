import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentController } from './student.controller';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
} from '../../application/student/use-cases/student.use-cases';
import { PrismaStudentRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-student.repository';
import { PrismaStudentGuardianRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository';

@Module({
  imports: [AuthModule],
  controllers: [StudentController],
  providers: [
    PrismaStudentRepository,
    { provide: 'StudentRepository', useExisting: PrismaStudentRepository },
    PrismaStudentGuardianRepository,
    { provide: 'StudentGuardianRepository', useExisting: PrismaStudentGuardianRepository },
    { provide: CreateStudentUseCase, useFactory: (r) => new CreateStudentUseCase(r), inject: ['StudentRepository'] },
    { provide: ListStudentsUseCase, useFactory: (r) => new ListStudentsUseCase(r), inject: ['StudentRepository'] },
    { provide: GetStudentUseCase, useFactory: (r) => new GetStudentUseCase(r), inject: ['StudentRepository'] },
    { provide: DeleteStudentUseCase, useFactory: (r) => new DeleteStudentUseCase(r), inject: ['StudentRepository'] },
    { provide: PatchStudentUseCase, useFactory: (r, g) => new PatchStudentUseCase(r, g), inject: ['StudentRepository', 'StudentGuardianRepository'] },
    { provide: GetMyStudentDataUseCase, useFactory: (r) => new GetMyStudentDataUseCase(r), inject: ['StudentRepository'] },
    { provide: GetMyChildrenUseCase, useFactory: (g, r) => new GetMyChildrenUseCase(g, r), inject: ['StudentGuardianRepository', 'StudentRepository'] },
    { provide: AssignGuardianUseCase, useFactory: (r, g) => new AssignGuardianUseCase(r, g), inject: ['StudentRepository', 'StudentGuardianRepository'] },
    { provide: RemoveGuardianUseCase, useFactory: (g) => new RemoveGuardianUseCase(g), inject: ['StudentGuardianRepository'] },
    { provide: ListGuardiansUseCase, useFactory: (r, g) => new ListGuardiansUseCase(r, g), inject: ['StudentRepository', 'StudentGuardianRepository'] },
  ],
  exports: ['StudentRepository', 'StudentGuardianRepository', PrismaStudentRepository, PrismaStudentGuardianRepository],
})
export class StudentModule {}
