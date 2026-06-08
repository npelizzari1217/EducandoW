import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceTypeController } from './attendance-type.controller';
import {
  CreateAttendanceTypeUseCase,
  UpdateAttendanceTypeUseCase,
  DeleteAttendanceTypeUseCase,
  ListAttendanceTypesUseCase,
  GetAttendanceTypeUseCase,
} from '../../application/attendance-type/use-cases/attendance-type.use-cases';
import { PrismaAttendanceTypeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceTypeController],
  providers: [
    PrismaService,
    {
      provide: PrismaAttendanceTypeRepository,
      useClass: PrismaAttendanceTypeRepository,
    },
    { provide: 'AttendanceTypeRepository', useExisting: PrismaAttendanceTypeRepository },
    {
      provide: CreateAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new CreateAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: UpdateAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new UpdateAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: DeleteAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new DeleteAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: ListAttendanceTypesUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new ListAttendanceTypesUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: GetAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new GetAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
  ],
})
export class AttendanceTypeModule {}
