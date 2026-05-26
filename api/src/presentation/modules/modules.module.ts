import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ListModulesUseCase, CreateModuleUseCase, UpdateModuleUseCase, DeleteModuleUseCase } from '../../application/modules/use-cases/modules.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModulesController],
  providers: [
    PrismaService,
    {
      provide: ListModulesUseCase,
      useFactory: (prisma) => new ListModulesUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateModuleUseCase,
      useFactory: (prisma) => new CreateModuleUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: UpdateModuleUseCase,
      useFactory: (prisma) => new UpdateModuleUseCase(prisma),
      inject: [PrismaService],
    },
    {
      provide: DeleteModuleUseCase,
      useFactory: (prisma) => new DeleteModuleUseCase(prisma),
      inject: [PrismaService],
    },
  ],
})
export class ModulesModule {}
