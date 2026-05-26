import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeacherController } from './teacher.controller';
import {
  CreateTeacherUseCase, ListTeachersUseCase, GetTeacherUseCase, DeleteTeacherUseCase,
  UpdateTeacherUseCase,
} from '../../application/teacher/use-cases/teacher.use-cases';
import { PrismaTeacherRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-teacher.repository';

@Module({
  imports: [AuthModule],
  controllers: [TeacherController],
  providers: [
    PrismaTeacherRepository,
    { provide: 'TeacherRepository', useExisting: PrismaTeacherRepository },
    { provide: CreateTeacherUseCase, useFactory: (r) => new CreateTeacherUseCase(r), inject: ['TeacherRepository'] },
    { provide: ListTeachersUseCase, useFactory: (r) => new ListTeachersUseCase(r), inject: ['TeacherRepository'] },
    { provide: GetTeacherUseCase, useFactory: (r) => new GetTeacherUseCase(r), inject: ['TeacherRepository'] },
    { provide: DeleteTeacherUseCase, useFactory: (r) => new DeleteTeacherUseCase(r), inject: ['TeacherRepository'] },
    { provide: UpdateTeacherUseCase, useFactory: (r) => new UpdateTeacherUseCase(r), inject: ['TeacherRepository'] },
  ],
  exports: ['TeacherRepository', PrismaTeacherRepository],
})
export class TeacherModule {}
