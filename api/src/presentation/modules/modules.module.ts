import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ListModulesUseCase, CreateModuleUseCase, UpdateModuleUseCase, DeleteModuleUseCase } from '../../application/modules/use-cases/modules.use-cases';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';

@Module({
  controllers: [ModulesController],
  providers: [
    PrismaService,
    AuthGuard,
    RolesGuard,
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
